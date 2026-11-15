//+------------------------------------------------------------------+
//| FxCruxLicenseExample.mq4                                          |
//| Minimal example showing how to gate an EA's trading logic on an   |
//| active FXCRUX license, using FxCruxLicense.mqh (MQL4 variant).    |
//|                                                                    |
//| Set FXCRUX_PRODUCT_NAME below to match the exact Product.name     |
//| configured for this tool in the FXCRUX admin panel.                |
//|                                                                    |
//| NOT compiled/tested here (no MetaTrader in this environment) -    |
//| compile in MetaEditor for MT4 and report any errors, the same     |
//| standing convention as every other trading-platform client in     |
//| this project.                                                      |
//+------------------------------------------------------------------+
#property strict
#include <FxCruxLicense.mqh>

input string FXCRUX_PRODUCT_NAME = "PerfectFootprintPro";

bool g_licenseActive = false;
datetime g_licenseExpiresAt = 0;
datetime g_lastCheck = 0;

int OnInit()
{
   // Deliberately NOT connecting here, and deliberately NOT using OnTimer()
   // either (reverted 2026-07-15). MetaTrader does not reliably deliver
   // socket-readable events in every execution context - confirmed for
   // OnInit(), and OnTimer() showed the same symptom. FxCrux_CheckLicense()
   // connects lazily on its own, so the first OnTick() call handles it.
   //
   // 2026-07-16 update: even from OnTick(), a live test proved the Engine
   // side works instantly and correctly (verified independently with a
   // non-MQL client) while MQL still failed specifically on the SECOND
   // blocking read within one call (reading the AUTH reply, right after the
   // first read - the challenge - had already succeeded in the same call).
   // FxCruxLicense.mqh now splits the handshake across two calls instead of
   // one continuous blocking sequence - see FxCrux_PumpHandshake() below.
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   FxCrux_Disconnect();
}

void OnTick()
{
   // Non-blocking - advances a pending handshake by at most one step (a
   // single quick check), regardless of the 10s throttle on starting *new*
   // checks below. Must be called every tick so a handshake started by
   // CheckLicenseIfDue() actually gets picked up soon after, not 10s later.
   FxCrux_PumpHandshake();

   CheckLicenseIfDue();

   if(!g_licenseActive)
      return; // no license: do nothing, regardless of any signal below

   // ... real trading logic goes here ...
}

//--- NOTE: only called from OnTick() - see OnInit()'s comment. This means the
//    license check only refreshes when a tick actually arrives; on a symbol
//    with zero ticks for an extended period (market closed, very thin
//    liquidity), a just-revoked license could stay "active" in the EA's eyes
//    until the next tick. Accepted trade-off - see OnInit()'s comment for why
//    OnTimer() isn't used instead.
void CheckLicenseIfDue()
{
   if(TimeCurrent() - g_lastCheck <= 10)
      return;

   bool wasActive = g_licenseActive;
   g_licenseActive = FxCrux_CheckLicense(FXCRUX_PRODUCT_NAME, g_licenseExpiresAt);
   g_lastCheck = TimeCurrent();

   if(!g_licenseActive)
      Comment("FXCRUX LICENSE INACTIVE - trading disabled for ", FXCRUX_PRODUCT_NAME);
   else
      Comment("FXCRUX license active - expires ", TimeToString(g_licenseExpiresAt));

   if(wasActive != g_licenseActive)
      Print("[FxCrux] License status changed for ", FXCRUX_PRODUCT_NAME, ": ", (g_licenseActive ? "ACTIVE" : "INACTIVE"));
}
