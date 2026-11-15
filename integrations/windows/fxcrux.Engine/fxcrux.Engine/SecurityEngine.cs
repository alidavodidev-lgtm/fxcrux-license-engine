using System;
using System.Security.Cryptography;
using System.Text;

public class SecurityEngine
{
    private static string ReadPublicKey()
    {
        string? path = Environment.GetEnvironmentVariable("FXCRUX_TRANSPORT_PUBLIC_KEY_PATH");
        if (string.IsNullOrWhiteSpace(path))
            throw new InvalidOperationException("Set FXCRUX_TRANSPORT_PUBLIC_KEY_PATH to the server transport public key.");

        return System.IO.File.ReadAllText(path);
    }

    // Notice the return type now includes 'byte[] RawAesKey'
    public static (string EncryptedPayload, string EncryptedAesKey, string AesIV, byte[] RawAesKey) EncryptData(string plainText)
    {
        using Aes aes = Aes.Create();
        aes.KeySize = 256;
        aes.GenerateKey();
        aes.GenerateIV();

        string encryptedPayload;
        using (var encryptor = aes.CreateEncryptor(aes.Key, aes.IV))
        {
            byte[] dataBytes = Encoding.UTF8.GetBytes(plainText);
            byte[] encryptedBytes = encryptor.TransformFinalBlock(dataBytes, 0, dataBytes.Length);
            encryptedPayload = Convert.ToBase64String(encryptedBytes);
        }

        string encryptedAesKey;
        using (RSA rsa = RSA.Create())
        {
            rsa.ImportFromPem(ReadPublicKey());
            // Remember we changed to OaepSHA1 for PHP compatibility
            byte[] encryptedKeyBytes = rsa.Encrypt(aes.Key, RSAEncryptionPadding.OaepSHA1);
            encryptedAesKey = Convert.ToBase64String(encryptedKeyBytes);
        }

        return (encryptedPayload, encryptedAesKey, Convert.ToBase64String(aes.IV), aes.Key);
    }

    // NEW METHOD: To decrypt the server's response
    public static string DecryptServerResponse(string encryptedPayloadBase64, string serverIvBase64, byte[] sessionAesKey)
    {
        using Aes aes = Aes.Create();
        aes.KeySize = 256;
        aes.Key = sessionAesKey;
        aes.IV = Convert.FromBase64String(serverIvBase64);

        using var decryptor = aes.CreateDecryptor(aes.Key, aes.IV);
        byte[] encryptedBytes = Convert.FromBase64String(encryptedPayloadBase64);
        byte[] decryptedBytes = decryptor.TransformFinalBlock(encryptedBytes, 0, encryptedBytes.Length);

        return Encoding.UTF8.GetString(decryptedBytes);
    }
}