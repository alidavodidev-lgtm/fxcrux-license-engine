//+------------------------------------------------------------------+
//| FxCruxLicense.mqh                                                 |
//| Talks to the local fxcrux.Engine over a TCP socket to check       |
//| whether this machine currently holds an active license for a      |
//| given product. No user credentials ever pass through this file -  |
//| the Engine already knows which machine/user it represents.        |
//|                                                                    |
//| NOT compiled/tested here (no MetaTrader in this environment) -     |
//| please compile in MetaEditor and report any errors. MT5 may        |
//| require 127.0.0.1 to be allowed under Tools > Options > Expert     |
//| Advisors (the same permission area used for WebRequest) before     |
//| SocketConnect will succeed.                                        |
//|                                                                    |
//| Handshake is deliberately split across two phases/calls instead   |
//| of one continuous blocking sequence - see FxCrux_BeginHandshake() |
//| and FxCrux_PumpHandshake() below for why (2026-07-16 finding).    |
//+------------------------------------------------------------------+
#property strict

#define FXCRUX_HOST            "127.0.0.1"
#define FXCRUX_PORT            47651
#define FXCRUX_TIMEOUT_MS      3000

// There is deliberately no compile-time shared secret here any more. A
// single constant baked into every customer's copy of this file could be
// extracted once and reused to stand up a fake local "Engine" that always
// answers active:true for every customer. Instead, each account gets its own
// pairing code (shown on the FXCrux App Hub screen after login) - paste it
// here once per EA/indicator. A leaked value only ever affects the one
// account it belongs to.
input string FxCrux_PairingCode = ""; // FXCrux pairing code (Windows app > App Hub)

int      fxcrux_socket = INVALID_HANDLE;
bool     fxcrux_authenticated = false;
datetime fxcrux_last_connect_attempt = 0;
#define FXCRUX_MIN_RECONNECT_SECONDS 2 // defense in depth - throttles reconnect attempts even if a caller checks every tick with no throttle of its own

// Handshake state machine - see FxCrux_BeginHandshake()/FxCrux_PumpHandshake().
#define FXCRUX_HS_IDLE               0
#define FXCRUX_HS_AWAITING_AUTH_REPLY 1
int      fxcrux_handshake_state = FXCRUX_HS_IDLE;
uint     fxcrux_handshake_started_tick = 0;

//--- Convert a byte array to a lowercase hex string
string FxCrux_BytesToHex(const uchar &bytes[])
{
   string result = "";
   for(int i = 0; i < ArraySize(bytes); i++)
      result += StringFormat("%02x", bytes[i]);
   return result;
}

//--- SHA-256(text) as a lowercase hex string, using MQL5's native CryptEncode
//    Note: the parameter can't be named "input" - that's a reserved MQL5 keyword
//    (used for EA input-parameter declarations), which broke compilation.
string FxCrux_Sha256Hex(string text)
{
   uchar data[], key[], hash[];
   StringToCharArray(text, data, 0, StringLen(text), CP_UTF8);
   // StringToCharArray may or may not append a trailing NUL depending on how count
   // is specified - only strip it if it's actually there, rather than assuming.
   // (An unconditional strip here was the likely cause of a real handshake mismatch:
   // if there was no trailing NUL, this was silently chopping off the last real byte.)
   int len = ArraySize(data);
   if(len > 0 && data[len - 1] == 0)
      ArrayResize(data, len - 1);

   CryptEncode(CRYPT_HASH_SHA256, data, key, hash);
   return FxCrux_BytesToHex(hash);
}

//--- Send one line (adds the trailing \n)
bool FxCrux_SendLine(string line)
{
   string withNewline = line + "\n";
   uchar data[];
   int len = StringToCharArray(withNewline, data, 0, StringLen(withNewline), CP_UTF8);
   // Only strip a trailing NUL if StringToCharArray actually appended one -
   // an unconditional strip here was a real, confirmed bug: with an explicit
   // count parameter, StringToCharArray may not add a NUL at all, in which
   // case this was silently chopping off the message's real last byte - the
   // trailing '\n' itself. Losing that newline means the Engine's line-based
   // reader (ReadLineAsync) never sees a line terminator and blocks forever
   // waiting for one that will never arrive - which exactly matches "Engine
   // never replies, every single time, no matter how long we wait" (2026-07-16
   // live-tested finding). FxCrux_Sha256Hex already had this same conditional
   // fix; this function had been missed.
   if(len > 0 && data[len - 1] == 0)
      len -= 1;
   return SocketSend(fxcrux_socket, data, len) == len;
}

//--- Blocking-ish read of one \n-terminated line (polls until timeout).
//    Only ever used where the caller already knows (via SocketIsReadable)
//    that at least some data is available, or for the very first read on a
//    freshly-connected socket - see the 2026-07-16 note on why a second
//    blocking read of this kind, back to back with a prior one in the same
//    function call, turned out to be unreliable.
string FxCrux_ReadLine(int timeoutMs)
{
   string result = "";
   uint startTick = GetTickCount();

   while(GetTickCount() - startTick < (uint)timeoutMs)
   {
      uint available = SocketIsReadable(fxcrux_socket);
      if(available > 0)
      {
         uchar buffer[];
         int received = SocketRead(fxcrux_socket, buffer, available, 100);
         for(int i = 0; i < received; i++)
         {
            if(buffer[i] == '\n')
               return result;
            result += CharToString(buffer[i]);
         }
      }
      else
      {
         Sleep(10);
      }
   }
   return result; // may be partial/empty on timeout
}

//--- Extract a JSON string field's value by naive substring search
//    (our protocol only ever emits flat, single-level JSON objects).
string FxCrux_JsonGetString(string json, string field)
{
   string needle = "\"" + field + "\":\"";
   int pos = StringFind(json, needle);
   if(pos < 0) return "";
   int start = pos + StringLen(needle);
   int end = StringFind(json, "\"", start);
   if(end < 0) return "";
   return StringSubstr(json, start, end - start);
}

bool FxCrux_JsonGetBool(string json, string field)
{
   string needle = "\"" + field + "\":true";
   return StringFind(json, needle) >= 0;
}

void FxCrux_ResetSocket()
{
   if(fxcrux_socket != INVALID_HANDLE)
   {
      SocketClose(fxcrux_socket);
      fxcrux_socket = INVALID_HANDLE;
   }
   fxcrux_handshake_state = FXCRUX_HS_IDLE;
}

//--- Phase 1: connect, read the challenge (proven reliable within one call),
//    compute+send the AUTH response, then STOP - deliberately does not read
//    the AUTH reply here. Live-tested 2026-07-16: a non-MQL5 TCP client
//    completed this entire handshake (including the AUTH reply read)
//    instantly against the real Engine, proving the Engine/pairing-secret/
//    backend side is correct - yet MQL5 consistently failed specifically on
//    the SECOND blocking read within one call (the AUTH reply), while the
//    FIRST (the challenge) consistently succeeded. This matches the
//    already-documented OnInit() constraint (MetaTrader doesn't reliably
//    deliver socket-readable events within one continuous blocking call),
//    generalized here to "a second blocking read right after a send, in the
//    same call" - not just OnInit specifically. Splitting the AUTH reply
//    into FxCrux_PumpHandshake(), called on a later, separate tick, gives
//    the terminal's own event loop a chance to run in between.
bool FxCrux_BeginHandshake()
{
   if(TimeCurrent() - fxcrux_last_connect_attempt < FXCRUX_MIN_RECONNECT_SECONDS)
      return false;
   fxcrux_last_connect_attempt = TimeCurrent();

   fxcrux_authenticated = false;

   if(FxCrux_PairingCode == "")
   {
      Print("[FxCrux] No pairing code set. Open the FXCrux Windows app, log in, and copy your ",
            "pairing code from the App Hub screen into this EA's inputs.");
      return false;
   }

   FxCrux_ResetSocket();

   fxcrux_socket = SocketCreate();
   if(fxcrux_socket == INVALID_HANDLE)
   {
      Print("[FxCrux] SocketCreate failed: ", GetLastError());
      return false;
   }

   if(!SocketConnect(fxcrux_socket, FXCRUX_HOST, FXCRUX_PORT, FXCRUX_TIMEOUT_MS))
   {
      Print("[FxCrux] Could not connect to Engine on ", FXCRUX_HOST, ":", FXCRUX_PORT,
            " - is fxcrux.Engine running? Error: ", GetLastError());
      FxCrux_ResetSocket();
      return false;
   }

   string challengeLine = FxCrux_ReadLine(FXCRUX_TIMEOUT_MS);
   string nonce = FxCrux_JsonGetString(challengeLine, "nonce");
   if(nonce == "")
   {
      Print("[FxCrux] No challenge received from Engine (timed out after ", FXCRUX_TIMEOUT_MS, "ms).");
      FxCrux_ResetSocket();
      return false;
   }

   string response = FxCrux_Sha256Hex(nonce + FxCrux_PairingCode);
   if(!FxCrux_SendLine("{\"type\":\"AUTH\",\"response\":\"" + response + "\"}"))
   {
      FxCrux_ResetSocket();
      return false;
   }

   // Deliberately not reading the reply here - see the comment above this
   // function. FxCrux_PumpHandshake(), called on a later tick, finishes it.
   fxcrux_handshake_state = FXCRUX_HS_AWAITING_AUTH_REPLY;
   fxcrux_handshake_started_tick = GetTickCount();
   return false; // not authenticated yet this call
}

//--- Phase 2: non-blocking check for the AUTH reply from a handshake that
//    FxCrux_BeginHandshake() started on an earlier call. Call this on every
//    OnTick()/OnTimer() - it returns immediately (a single SocketIsReadable
//    poll) if the reply isn't in yet, rather than blocking, so it's cheap to
//    call unconditionally regardless of any check-throttle a caller applies
//    to starting new checks.
void FxCrux_PumpHandshake()
{
   if(fxcrux_handshake_state != FXCRUX_HS_AWAITING_AUTH_REPLY)
      return;

   uint available = SocketIsReadable(fxcrux_socket);
   if(available == 0)
   {
      if(GetTickCount() - fxcrux_handshake_started_tick > (uint)FXCRUX_TIMEOUT_MS)
      {
         Print("[FxCrux] Timed out waiting for the AUTH reply (checked across multiple ticks).");
         FxCrux_ResetSocket();
      }
      return; // not ready yet - try again on a later tick
   }

   string authResult = FxCrux_ReadLine(500); // data is already known to be available
   if(StringFind(authResult, "AUTH_OK") < 0)
   {
      string reason = FxCrux_JsonGetString(authResult, "reason");
      if(reason == "not_paired")
         Print("[FxCrux] Engine has no pairing code loaded yet - log in with the FXCrux Windows app first.");
      else
         Print("[FxCrux] Engine rejected the handshake (wrong pairing code?). Reply: ", authResult);
      FxCrux_ResetSocket();
      return;
   }

   fxcrux_authenticated = true;
   fxcrux_handshake_state = FXCRUX_HS_IDLE;
}

//--- Ask whether this machine currently has an active license for `product`.
//    Returns false (fail-closed) if not authenticated yet, or on any
//    connection/protocol error. Call FxCrux_PumpHandshake() on every tick
//    separately (see the example EA) so a pending handshake keeps
//    progressing even on ticks where this function isn't called (it's
//    normally throttled to once every several seconds by the caller).
bool FxCrux_CheckLicense(string product, datetime &expiresAt)
{
   expiresAt = 0;

   if(!fxcrux_authenticated || fxcrux_socket == INVALID_HANDLE || !SocketIsConnected(fxcrux_socket))
   {
      if(fxcrux_handshake_state == FXCRUX_HS_IDLE)
         FxCrux_BeginHandshake();
      return false; // never authenticated within the same call that starts a handshake
   }

   if(!FxCrux_SendLine("{\"type\":\"CHECK_LICENSE\",\"product\":\"" + product + "\"}"))
      return false;

   string statusLine = FxCrux_ReadLine(FXCRUX_TIMEOUT_MS);
   if(statusLine == "")
      return false;

   bool active = FxCrux_JsonGetBool(statusLine, "active");
   string expiresStr = FxCrux_JsonGetString(statusLine, "expiresAt");
   if(expiresStr != "")
      expiresAt = StringToTime(StringSubstr(expiresStr, 0, 19)); // "YYYY-MM-DDTHH:MM:SS..."

   return active;
}

//--- True once the handshake has succeeded and the socket is still open -
//    useful for a status indicator separate from the per-product license flag.
bool FxCrux_IsReady()
{
   return fxcrux_authenticated && fxcrux_socket != INVALID_HANDLE && SocketIsConnected(fxcrux_socket);
}

//--- Call from OnDeinit to release the socket cleanly.
void FxCrux_Disconnect()
{
   FxCrux_ResetSocket();
   fxcrux_authenticated = false;
}
