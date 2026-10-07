# Exam Device Companion — Student Guide & Privacy Notice

**Application**: ProctorNet Online Examination System  
**Component**: Exam Device Companion (`proctornet-companion`)  
**Target Users**: Students taking supervised online examinations on personal laptops/desktops  
**Version**: 1.0.0  

---

## 1. What is the Exam Device Companion?

The **Exam Device Companion** is a lightweight, temporary helper application that confirms your computer meets the examination integrity requirements. It runs locally on your computer while you take your exam and communicates directly with the ProctorNet exam server.

### What it checks
- Whether remote-access, screen-sharing, or screen-recording software is active (e.g., AnyDesk, TeamViewer, OBS).
- How many physical displays are connected to your computer (single-display policy).
- Whether your session is being run inside a virtual machine or remote desktop environment.
- Whether virtual camera driver software is intercepting your webcam feed.

### What it NEVER does (Our Privacy Guarantee)
- **Zero file access**: It never scans, opens, or uploads your personal files, downloads, or documents.
- **Zero browsing history**: It never views your browser tabs, history, bookmarks, or web traffic.
- **Zero keystroke/clipboard logging**: It never captures keystrokes, passwords, or clipboard content.
- **Zero audio/video recording**: The companion itself never accesses your microphone or camera stream (webcam proctoring is handled directly by your browser with your explicit consent).
- **Zero permanent changes**: It does not install any drivers, services, or background daemons. When the exam is over, you simply delete the single downloaded file.

---

## 2. Step-by-Step Setup Guide

Follow these three simple steps to start your exam:

```
[ Step 1: Download ]  ──────>  [ Step 2: Run & Enter Code ]  ──────>  [ Step 3: Exam Unlocked ]
Download the single            Launch the file and type              Companion status turns green;
executable for your OS         the 8-character code from screen      exam interface unlocks automatically
```

### Step 1: Download the Companion
On the ProctorNet **Security Check** or **Device Check** screen:
1. Review and check the **Student Consent** checkbox.
2. Click the **"Download Exam Device Companion"** button. The server will automatically provide the executable matched to your operating system.

### Step 2: Launch the Companion & Enter Your Code

#### On Windows (Windows 10 / 11):
1. Locate `proctornet-companion.exe` in your **Downloads** folder and double-click it.
2. If **Windows Defender SmartScreen** appears:
   - Click the underlined link: **"More info"**.
   - Click the button: **"Run anyway"**.
3. A terminal window will open with the ProctorNet logo, asking for your pairing code.
4. Type the **8-character code** shown on your exam screen (e.g., `7K3QX9MD`) and press **Enter**.
5. The window will display: `[Connected] Active heartbeat established. You may now return to your browser.`

#### On macOS (Apple Silicon M1/M2/M3 & Intel):
1. Locate `proctornet-companion` in your **Downloads** folder.
2. If macOS **Gatekeeper** blocks the application:
   - Right-click (or Control-click) the file in **Finder** and select **"Open"**.
   - In the security prompt, click **"Open"**.
   - Alternatively: Open **System Settings → Privacy & Security**, scroll to the bottom, and click **"Open Anyway"**.
3. Type the **8-character code** shown on your browser screen and press **Enter**.
4. The companion will establish connection and report healthy status.

#### On Linux (Ubuntu / Debian / Fedora):
1. Open a terminal or file manager in your Downloads directory.
2. Ensure executable permissions: `chmod +x proctornet-companion`
3. Run: `./proctornet-companion`
4. Type the **8-character code** from your browser screen and press **Enter**.

### Step 3: Begin Your Exam
Within 2 seconds of entering your code:
- The browser status card will turn **Green** with the message **"Companion Connected & Healthy"**.
- The **"Proceed to Exam"** button will activate.
- Keep the companion window open in the background while taking your exam.

---

## 3. What to Do If You Are Blocked

If the companion detects prohibited software or hardware configurations, the exam screen will display an amber or red warning card indicating the exact issue:

| Notification Message | Why it Appeared | How to Fix It |
| :--- | :--- | :--- |
| **"Please close [Program Name] and keep this page open — your exam will continue automatically."** | Prohibited remote-desktop, screen recorder, or AI assistant software was detected (e.g., AnyDesk, TeamViewer, OBS, Discord screen share). | 1. Open Task Manager / Activity Monitor and close the listed application.<br>2. Within 15 to 30 seconds, the companion will report a clean state, and your exam will resume automatically. |
| **"Multiple displays detected. Please disconnect secondary monitors."** | More than one monitor is connected to your computer. | 1. Unplug HDMI, DisplayPort, or USB-C monitor cables.<br>2. If using a laptop with external screen, disconnect the external screen.<br>3. Companion re-checks in 15 seconds. |
| **"Virtual machine detected."** | The test is running inside a VM (VirtualBox, VMware, Parallels, Hyper-V, QEMU). | Exams must be taken directly on physical hardware. Please reboot into your primary operating system. |
| **"Virtual camera detected."** | A software camera driver (OBS Virtual Cam, ManyCam, EpocCam) is active. | Close the virtual camera software and select your physical laptop webcam in browser settings. |
| **"We lost contact with the Companion. Reconnect within 90 seconds to avoid your exam being paused."** | Network hiccup, laptop lid closed, or companion accidentally closed. | 1. Check your internet connection.<br>2. If the companion window closed, re-launch it from Downloads and enter the new code.<br>3. Once connected, your exam continues where you left off. |

---

## 4. How to Exit & Uninstall

- **During the Exam**: Do NOT close the companion window. If the companion closes, your exam will pause after 60 seconds until you reconnect.
- **After Submitting the Exam**: Once you click **"Submit Exam"**, the server automatically signals the companion to terminate (`exit: true`). The companion window will display a completion notice and close itself.
- **Uninstalling**: The Exam Device Companion is a **portable Single Executable Application**. It does not install any system files or registry keys. To completely remove it from your computer, simply move the downloaded executable to your **Trash / Recycle Bin** and delete it.

---

## 5. Practice Pairing (Recommended 3–7 Days Before Exam)

To ensure your computer, network, and security settings are fully compatible before exam day:
1. Log into ProctorNet 3 to 7 days before your scheduled examination date.
2. Navigate to **Device Precheck** from your student dashboard.
3. Download the companion and perform a test pairing (`scope=PRECHECK`).
4. If your institutional Wi-Fi, proxy, or antivirus triggers any warning, contact campus IT or your exam coordinator early so accommodations or configuration guidance can be provided.
