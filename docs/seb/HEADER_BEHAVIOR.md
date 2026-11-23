# SafeExamBrowser Header Generation & Verification Behavior

## 1. Overview
SafeExamBrowser (SEB) validates client-server integrity through cryptographic request headers:
- `X-SafeExamBrowser-ConfigKeyHash` (Configuration Key Hash)
- `X-SafeExamBrowser-BrowserExamKeyHash` / `X-SafeExamBrowser-RequestHash` (Browser Exam Key Hash)

This document specifies the exact ground-truth mechanics based on the official Windows source code (`SafeExamBrowser/seb-win-refactoring`).

---

## 2. Configuration Key Calculation

### 2.1 Raw Data Source
- When SEB loads a `.seb` file (XML plist or compressed/encrypted binary), the parser (`SafeExamBrowser.Configuration.DataFormats.XmlParser`) produces a nested `IDictionary<string, object>` of key-value pairs representing the plist dictionary (`ConfigurationRepository.cs:139-150`).

### 2.2 Canonical JSON Serialization
In `SafeExamBrowser.Configuration.ConfigurationData.DataProcessor.CalculateConfigurationKey`:
The dictionary is converted to canonical JSON using `SafeExamBrowser.Configuration.ConfigurationData.Json.Serialize(rawData, writer)`:
1. **Key Sorting**: Dictionary entries are strictly sorted alphabetically by key using `StringComparer.InvariantCulture`:
   `dictionary.OrderBy(d => d.Key, StringComparer.InvariantCulture)`
2. **Filtered Keys**:
   - `originatorVersion` is omitted:
     `kvp.Key.Equals(Keys.General.OriginatorVersion, StringComparison.OrdinalIgnoreCase)`
   - Empty sub-dictionaries are omitted:
     `!(kvp.Value is IDictionary<string, object> d) || d.Any()`
3. **Value Formatting**:
   - **Dictionary**: `{"key1":value1,"key2":value2}`
   - **Array/List**: `[item1,item2]`
   - **Byte Array (`byte[]`)**: Base64 encoded string: `"<base64>"`
   - **Date (`DateTime`)**: ISO 8601 round-trip string: `date.ToString("o")`
   - **Boolean (`bool`)**: Lowercase literal: `true` or `false`
   - **Integer (`int`)**: Invariant decimal: `integer.ToString(NumberFormatInfo.InvariantInfo)`
   - **Float/Double (`double`)**: Invariant decimal: `number.ToString(NumberFormatInfo.InvariantInfo)`
   - **String (`string`)**: Direct string in quotes: `"<text>"`
   - **Null**: Double quotes `""`
4. **Hashing**:
   - The serialized UTF-8 stream is hashed with SHA-256 (`SHA256Managed.ComputeHash(stream)`).
   - Formatted as a 64-character lowercase hexadecimal string without hyphens.
   - Saved into `settings.Browser.ConfigurationKey`.

---

## 3. Request Header Hash Calculation

### 3.1 Timing & Request Interception
- File: `SafeExamBrowser.Browser/Handlers/ResourceHandler.cs:137`
- When SEB's browser engine (CefSharp / Chromium) issues an HTTP request, `ResourceHandler.OnBeforeResourceLoad` evaluates header injection.

### 3.2 Eligibility Condition
Headers are injected ONLY IF:
1. `settings.SendConfigurationKey == true`
2. AND either:
   - `request.ResourceType == ResourceType.MainFrame`, OR
   - The request host matches the top-level page host:
     `pageUrl.Host.Equals(requestUrl.Host, StringComparison.OrdinalIgnoreCase)`

Requests to external origins (e.g. CDNs, analytics, external assets) are strictly exempt and do NOT receive the header.

### 3.3 What String Is Hashed
In `SafeExamBrowser.Configuration.Cryptography.KeyGenerator.CalculateConfigurationKeyHash`:
```csharp
public string CalculateConfigurationKeyHash(string configurationKey, string url)
{
    var urlWithoutFragment = url.Split('#')[0];
    var hash = algorithm.Value.ComputeHash(Encoding.UTF8.GetBytes(urlWithoutFragment + configurationKey));
    var key = ToString(hash);

    return key;
}
```

- **Exact Input**: UTF-8 bytes of `urlWithoutFragment + configurationKey`
- **URL Form**:
  - Full canonical URL: `https://<host>[:<port>]/<path>[?<query>]`
  - URL fragments (`#...`) are stripped by `url.Split('#')[0]`.
  - Query parameters (e.g. `?launch=...` or `?examId=...`) ARE included in the hash.
  - Port is included if explicitly present in the Chromium request URL (default ports 80/443 are generally omitted by Chromium).
- **Algorithm**: Standard SHA-256 (`SHA256Managed`), lowercase hexadecimal string without hyphens (`425b8c...`).

---

## 4. Error Attribution & Trigger Conditions

### 4.1 "Safe Exam Browser Configuration Mismatch" Error
- **Frontend Source**: `frontend/src/lib/studentErrors.js:72-76`
  ```javascript
  SEB_HEADER_MISMATCH: {
    title: 'Safe Exam Browser Configuration Mismatch',
    message: 'The security configuration header did not match this server. Sign in with your institutional password to continue.'
  }
  ```
- **Backend Trigger**: `backend/src/middleware/seb.js:395` & `414-419`
  When `mode === 'enforce'` and `POST /api/v1/attempts/exams/:id/start` receives a request where:
  - `X-SafeExamBrowser-ConfigKeyHash` is present
  - `receivedHeader !== sha256(canonicalUrl + activeKey)`
  The server responds with HTTP 403:
  ```json
  {
    "code": "SEB_HEADER_MISMATCH",
    "message": "Safe Exam Browser configuration check failed. Configuration Key header mismatch.",
    "requestId": "..."
  }
  ```

### 4.2 Decoupled Exchange Step
- The launch token exchange endpoint `GET /api/v1/seb/exchange?launch=...` (`backend/src/modules/seb/seb.controller.js:443`) does NOT block on header mismatch; it logs the diagnostic mismatch, sets auth cookies, and issues a 302 redirect.
- The block occurs strictly on subsequent content endpoints protected by `verifySeb` middleware when in `enforce` mode.
