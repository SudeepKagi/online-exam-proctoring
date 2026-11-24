# Safe Exam Browser (SEB) Launch Handoff & Configuration Architecture

> **Document Status**: DESIGN SPECIFICATION  
> **Source Evidence**: `SafeExamBrowser/seb-win-refactoring` (SEB 3.x Windows official source), SafeExamBrowser.org Developer Specifications.  
> **Verification Status**: Static C# code analysis verified; runtime protocol exchange marked **[UNVERIFIED - PENDING PHASE 1 E2E TEST]** until verified on Windows workstation.

---

## 1. URL Protocol & Query Forwarding Mechanism

### 1.1 The Protocol Link Syntax
Safe Exam Browser registers the `seb://` (plain HTTP) and `sebs://` (secure HTTPS) custom URI schemes on Windows and macOS.
When a student clicks a `sebs://` link:
```
sebs://<domain>/api/v1/seb/config/<download-token>??launch=<exchange-token>
```

### 1.2 C# Code Analysis in SEB 3.x (Windows)
In `SafeExamBrowser.Runtime/Operations/Session/ConfigurationOperation.cs` (lines 246–257):
```csharp
private void HandleStartUrlQuery(Uri uri, UriSource source)
{
    if (source == UriSource.Reconfiguration && Uri.TryCreate(Context.ReconfigurationUrl, UriKind.Absolute, out var reconfigurationUri))
    {
        uri = reconfigurationUri;
    }
    if (uri != default && uri.Query.LastIndexOf('?') > 0)
    {
        Context.Next.Settings.Browser.StartUrlQuery = uri.Query.Substring(uri.Query.LastIndexOf('?'));
    }
}
```

In `SafeExamBrowser.Browser/Responsibilities/Browser/WindowHandlingResponsibility.cs` (lines 134–151):
```csharp
private string GenerateStartUrl()
{
    var url = Settings.StartUrl;
    if (Settings.UseQueryParameter)
    {
        if (url.Contains("?") && Settings.StartUrlQuery?.Length > 1 && Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            url = url.Replace(uri.Query, $"{uri.Query}&{Settings.StartUrlQuery.Substring(1)}");
        }
        else
        {
            url = $"{url}{Settings.StartUrlQuery}";
        }
    }
    return url;
}
```

### 1.3 The Doubled `??` Requirement
1. SEB executes `uri.Query.LastIndexOf('?') > 0`.
2. A single `?` in `sebs://host/path?param=value` is at index 0 of `uri.Query`. `LastIndexOf('?') > 0` evaluates to **`false`**. SEB will **NOT** forward the parameter.
3. With doubled `??` (e.g., `sebs://host/path?configToken=xyz??launch=abc123token`), `LastIndexOf('?')` finds the second `?` at index > 0.
4. SEB extracts `.Substring(LastIndexOf('?'))` -> `?launch=abc123token` as `StartUrlQuery`.
5. If `Settings.UseQueryParameter` (`startURLAppendQueryParameter == true`), SEB appends `?launch=abc123token` (or `&launch=abc123token` if Start URL already has query parameters) when loading the `StartURL`.

---

## 2. Setting Keys Reference

Derived directly from `SafeExamBrowser.Settings/Settings/Keys.cs` and SEB Plist schema:

| Feature / Purpose | Plist Key String | Type | SEB Config Tool Location & Description |
| :--- | :--- | :--- | :--- |
| **Start URL** | `startURL` | String | *General -> Start URL*: Initial page loaded when SEB launches (`/seb/enter`). |
| **Query Parameter Forwarding** | `startURLAppendQueryParameter` | Boolean | *Exam -> Query String Parameter -> Allow Query Parameter*: When true, appends `StartUrlQuery` to `StartURL`. |
| **HTTP Request Headers (BEK/CK)** | `sendBrowserExamKey` | Boolean | *Exam -> Browser Exam Key -> Send Browser Exam Key & Config Key in HTTP Request*: Enables `X-SafeExamBrowser-RequestHash` / `X-SafeExamBrowser-ConfigKeyHash`. |
| **Quit URL** | `quitURL` | String | *Session / Quitting -> Quit URL*: Navigation to this URL quits SEB. |
| **Quit URL Confirm** | `quitURLConfirm` | Boolean | *Session / Quitting -> Ask user to confirm quitting when loading Quit URL*. |
| **URL Filter Enable** | `URLFilterEnable` | Boolean | *Network -> Filter -> Enable URL Filtering*. |
| **URL Filter Content** | `URLFilterEnableContentFilter` | Boolean | *Network -> Filter -> Enable Content Filtering*. |
| **URL Filter Rules** | `URLFilterRules` | Array of Dicts | *Network -> Filter -> Filter Rules*: List of dictionaries containing `action` (1=allow, 0=block), `regex` (bool), `expression` (pattern). |
| **Clear Cookies at Start** | `examSessionClearCookiesOnStart` | Boolean | *Browser -> Delete cookies on session startup*. |
| **Clear Cookies at End** | `examSessionClearCookiesOnEnd` | Boolean | *Browser -> Delete cookies on session shutdown*. |

---

## 3. SEB Config Key Excluded Keys

The SEB Configuration Key (CK) is a SHA-256 hash computed across the XML Plist representation of the configuration file. To allow runtime flexibility without invalidating security, the official SEB specification excludes specific keys from the hash calculation:

1. **`originatorVersion`**: Version of SEB Config Tool that generated the file.
2. **`startURL`** *(Only in legacy SEB specs when query appending is disabled; included in modern CK specs)*.
3. **`sendBrowserExamKey`**: Toggle for sending HTTP headers.
4. **`examKeySalt`**: The 32-byte binary salt used for Browser Exam Key (BEK) computation.
5. **Runtime-modified settings**: Any key dynamically overridden by MDM / command-line flags.

---

## 4. `.seb` File Format & Plain vs. Encrypted Detection

### 4.1 Compression (GZip)
In `SafeExamBrowser.Configuration/DataCompression/GZipCompressor.cs`:
Standard `.seb` files generated by the official SEB Configuration Tool are compressed using GZip:
- **Magic Bytes**: `0x1F, 0x8B, 0x08` (`ID1 = 0x1F`, `ID2 = 0x8B`, `CM = 8` / Deflate).

### 4.2 Stream Headers (4-Character Magic Prefix)
In `SafeExamBrowser.Configuration/DataFormats/BinaryParser.cs` & `BinaryBlock.cs`:
After decompressing the GZip stream (or directly on uncompressed data), the first 4 bytes indicate the data format:

| Prefix | Enum / Type | Description | Classification |
| :--- | :--- | :--- | :--- |
| `<?xm` | XML Plist (`<?xml ...>`) | Plain unencrypted Apple XML property list. | **Plain / Unencrypted** |
| `plnd` | `BinaryBlock.PlainData` | SEB binary container without encryption. | **Plain / Unencrypted** |
| `pswd` | `BinaryBlock.Password` | Encrypted with settings/admin password. | **Encrypted** |
| `pwcc` | `BinaryBlock.PasswordConfigureClient` | Encrypted for client configuration. | **Encrypted** |
| `pkhs` | `BinaryBlock.PublicKey` | Encrypted with RSA/X.509 certificate. | **Encrypted** |
| `phsk` | `BinaryBlock.PublicKeySymmetric` | Encrypted with symmetric public key. | **Encrypted** |

### 4.3 Why Previous Detection Failed
Previous code executed `buffer.toString().startsWith('<plist')` directly on the raw file buffer. Because SEB Config Tool exports files with GZip compression, the raw buffer began with `0x1F 0x8B 0x08`, failing the text check and misclassifying plain `.seb` files as invalid or encrypted.
**Fix**:
1. Check if first 3 bytes match `0x1F, 0x8B, 0x08`.
2. If so, decompress using `zlib.gunzipSync()`.
3. Check the first 4 bytes of the resulting buffer against `<?xm` or `plnd` vs `pswd`/`pwcc`/`pkhs`/`phsk`.

---

## 5. Trace: Why "Launch in Safe Exam Browser" Ends at Login Page Today

1. **Student Pre-Check in Chrome**:
   - The student logs in at `https://proctornet.duckdns.org/student/login` and completes system pre-checks.
   - The student clicks "Launch in Safe Exam Browser".
2. **Current Link Formation**:
   - Currently, the application generates a generic link or prompts the student to download `proctornet.seb` or open `sebs://proctornet.duckdns.org/...`.
3. **Static `StartURL` in Uploaded `.seb` File**:
   - The administrator configured `proctornet.seb` with `StartURL = "https://proctornet.duckdns.org/student/login"` (or `/login`).
   - `startURLAppendQueryParameter` was either `false` or the launch link lacked the doubled `??` query forwarder.
4. **SEB Process Launch**:
   - SEB opens in isolated sandbox mode with a clean, isolated cookie jar (unaware of Chrome's session).
   - Because query forwarding was not active, SEB navigated unconditionally to its static `StartURL` (`/student/login`).
5. **The Second Login Problem**:
   - The student is greeted with the login screen inside SEB, creating confusion and failing the intended seamless transition.

---

## 6. Target Architecture: Seamless Single-Use Launch Handoff

```
[ Student in Chrome ]
       |
       | 1. Completes Pre-Check (Photo, System Check)
       | 2. Requests SEB Launch Token (POST /api/v1/seb/launch-token)
       v
[ Backend / API ]
       |
       | Generates 32-byte cryptographically secure token (SHA-256 hashed in DB/Store)
       | Returns: sebs://host/api/v1/seb/config/<download-token>??launch=<exchange-token>
       v
[ OS launches SEB ]
       |
       | 3. SEB downloads config via GET /api/v1/seb/config/<download-token>
       | 4. SEB applies config (kiosk mode, keys, StartURL)
       | 5. SEB appends ?launch=<exchange-token> to StartURL
       | 6. SEB navigates to StartURL: GET /api/v1/seb/exchange?launch=<exchange-token>
       v
[ Backend Exchange Endpoint ]
       |
       | Validates exchange token hash, expiry (5 min), and single-use
       | In enforce mode: validates X-SafeExamBrowser-ConfigKeyHash header
       | Issues fresh HttpOnly JWT session cookie for the student
       | Redirects (HTTP 302) to /student/exams/:id/start (Exam Arena)
       v
[ SEB Enters Exam Arena Directly ]
```

*Verification status: To be validated in Phase 1 and Phase 4 via end-to-end integration and manual verification.*
