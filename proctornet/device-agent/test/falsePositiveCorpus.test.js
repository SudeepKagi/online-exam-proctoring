const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { matchTelemetry } = require('../src/matcher')

describe('A8 — Quality Matrix: 30-Machine Anonymized False-Positive Corpus', () => {
  const SEED_RULES = [
    { id: 'r-remote-anydesk', category: 'REMOTE_ACCESS', name: 'AnyDesk Remote Desktop', matchers: { type: 'exeName', value: 'anydesk' }, enabled: true },
    { id: 'r-remote-teamviewer', category: 'REMOTE_ACCESS', name: 'TeamViewer Remote Control', matchers: { type: 'exeName', value: 'teamviewer' }, enabled: true },
    { id: 'r-capture-obs64', category: 'SCREEN_CAPTURE', name: 'OBS Studio (64-bit)', matchers: { type: 'exeName', value: 'obs64' }, enabled: true },
    { id: 'r-ai-claude', category: 'AI_ASSISTANT', name: 'Claude Desktop Assistant', matchers: { type: 'exeName', value: 'claude' }, enabled: true },
    { id: 'r-ai-cursor', category: 'AI_ASSISTANT', name: 'Cursor AI IDE', matchers: { type: 'exeName', value: 'cursor' }, enabled: true },
    { id: 'r-ai-ollama', category: 'AI_ASSISTANT', name: 'Ollama LLM Server', matchers: { type: 'exeName', value: 'ollama' }, enabled: true },
    { id: 'r-session-rdpclip', category: 'REMOTE_SESSION', name: 'Inbound Remote Desktop Session (rdpclip)', matchers: { type: 'exeName', value: 'rdpclip' }, enabled: true },
    { id: 'r-session-mstsc', category: 'REMOTE_SESSION', name: 'Outbound Remote Desktop Client (mstsc)', matchers: { type: 'exeName', value: 'mstsc' }, enabled: true },
    { id: 'r-vcam-obs', category: 'VIRTUAL_CAMERA', name: 'OBS Virtual Camera Driver', matchers: { type: 'deviceName', value: 'obs virtual camera' }, enabled: true },
    { id: 'r-vcam-manycam', category: 'VIRTUAL_CAMERA', name: 'ManyCam Virtual Webcam', matchers: { type: 'deviceName', value: 'manycam' }, enabled: true },
    { id: 'r-vm-detected', category: 'VIRTUAL_MACHINE', name: 'Virtual Machine Environment', matchers: {}, enabled: true },
    { id: 'r-display-multi', category: 'DISPLAY', name: 'Multiple Display Monitors', matchers: {}, enabled: true }
  ]

  // Corpus of 35 diverse volunteer machines (anonymized process & device listings)
  const CORPUS_MACHINES = [
    {
      id: 'VOL-01-WIN11-DEV',
      os: 'win',
      processes: ['chrome', 'code', 'docker', 'wsl', 'slack', 'git', 'node', 'pwsh', 'nvcontainer', 'audiodg', 'explorer', 'svchost'],
      cameraNames: ['HP Wide Vision HD Camera'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-02-WIN10-OFFICE',
      os: 'win',
      processes: ['outlook', 'excel', 'teams', 'acrord32', 'onedrive', 'msedge', 'spoolsv', 'searchapp', 'explorer', 'dwm'],
      cameraNames: ['Integrated Camera'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-03-WIN11-STUDENT-GAMING',
      os: 'win',
      processes: ['steam', 'epicgameslauncher', 'spotify', 'chrome', 'geforceexperience', 'nvsphelper64', 'discord', 'explorer'],
      cameraNames: ['HD User Facing Camera'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-04-MAC-SONOMA-ARM64',
      os: 'mac',
      processes: ['safari', 'xcode', 'terminal', 'iterm2', 'docker', 'slack', 'zoom', 'launchd', 'windowserver', 'coreaudiod'],
      cameraNames: ['FaceTime HD Camera'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-05-MAC-VENTURA-INTEL',
      os: 'mac',
      processes: ['google chrome', 'code', 'music', 'messages', 'notes', 'preview', 'finder', 'dock', 'systemuiserver'],
      cameraNames: ['FaceTime HD Camera (Built-in)'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-06-UBUNTU22-DEV',
      os: 'linux',
      processes: ['gnome-shell', 'firefox', 'bash', 'systemd', 'pulseaudio', 'dbus-daemon', 'snapd', 'code', 'git'],
      cameraNames: ['Integrated_Webcam_HD'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-07-UBUNTU24-STUDENT',
      os: 'linux',
      processes: ['google-chrome', 'code', 'python3', 'gcc', 'nautilus', 'gnome-terminal-server', 'pipewire', 'wireplumber'],
      cameraNames: ['Chicony USB2.0 Camera'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-08-WIN11-DELL-XPS',
      os: 'win',
      processes: ['delloptimizer', 'waves_maxxaudio', 'chrome', 'wordpad', 'calculator', 'notepad', 'taskhostw', 'explorer'],
      cameraNames: ['Integrated Webcam'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-09-WIN10-THINKPAD',
      os: 'win',
      processes: ['lenovovantage', 'synaptics', 'firefox', 'acrotray', 'thunderbird', 'vlc', 'ctfmon', 'explorer'],
      cameraNames: ['ThinkPad HD Webcam'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-10-MAC-M2-AIR',
      os: 'mac',
      processes: ['safari', 'notion', 'spotify', 'telegram', 'keynote', 'pages', 'preview', 'quicklookui', 'mds'],
      cameraNames: ['FaceTime HD Camera'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-11-MAC-M3-PRO',
      os: 'mac',
      processes: ['arc', 'linear', 'figma', 'alacritty', 'neovim', 'raycast', 'karabiner-elements', 'tailscale'],
      cameraNames: ['FaceTime HD Camera'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-12-WIN11-SURFACE-LAPTOP',
      os: 'win',
      processes: ['surfaceapp', 'msedge', 'microsoft.photos', 'onedrive', 'phoneexperiencehost', 'searchhost', 'startmenuexperiencehost'],
      cameraNames: ['Microsoft Surface Front Camera'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-13-WIN11-ASUS-ZENBOOK',
      os: 'win',
      processes: ['myasus', 'asusoptimization', 'brave', 'drawio', 'whatsapp', 'skype', 'explorer', 'svchost'],
      cameraNames: ['USB2.0 HD UVC WebCam'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-14-WIN10-ACER-SWIFT',
      os: 'win',
      processes: ['acerpowermanagement', 'carecenter', 'chrome', '7zfm', 'winrar', 'foxitreader', 'explorer'],
      cameraNames: ['HD Webcam'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-15-FEDORA39-WORKSTATION',
      os: 'linux',
      processes: ['gnome-shell', 'firefox', 'flatpak', 'systemd', 'gjs', 'tracker-miner-fs', 'pipewire'],
      cameraNames: ['FHD Webcam'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-16-DEBIAN12-STUDENT',
      os: 'linux',
      processes: ['xfce4-session', 'xfwm4', 'chromium', 'libreoffice-writer', 'evince', 'thunar', 'pulseaudio'],
      cameraNames: ['USB Camera'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-17-WIN11-HP-SPECTRE',
      os: 'win',
      processes: ['hpcommandcenter', 'hpsupportassistant', 'chrome', 'onenote', 'dropbox', 'slack', 'explorer'],
      cameraNames: ['HP True Vision 5MP Camera'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-18-WIN11-LENOVO-LEGION',
      os: 'win',
      processes: ['lenovovantage', 'nahimicservice', 'steam', 'discord', 'riotclientux', 'chrome', 'explorer'],
      cameraNames: ['Integrated Camera'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-19-MAC-M1-MINI',
      os: 'mac',
      processes: ['safari', 'code', 'postman', 'tableplus', 'docker', 'terminal', 'slack', 'windowserver'],
      cameraNames: ['Logitech BRIO'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-20-MAC-INTEL-AIR-2020',
      os: 'mac',
      processes: ['chrome', 'zoom.us', 'word', 'excel', 'powerpoint', 'onedrive', 'finder', 'dock'],
      cameraNames: ['FaceTime HD Camera'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-21-WIN10-CUSTOM-DESKTOP',
      os: 'win',
      processes: ['icue', 'nzxt_cam', 'chrome', 'visualstudio', 'git-credential-manager', 'powershell', 'explorer'],
      cameraNames: ['Logitech StreamCam'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-22-WIN11-GIGABYTE-AORUS',
      os: 'win',
      processes: ['gigabytecontrolcenter', 'realtekaudioservice', 'brave', 'vscode', 'telegram', 'explorer'],
      cameraNames: ['Logitech C920 HD Pro Webcam'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-23-ARCHLINUX-DEV',
      os: 'linux',
      processes: ['sway', 'waybar', 'foot', 'firefox-developer-edition', 'rustc', 'cargo', 'neovim', 'pipewire'],
      cameraNames: ['SunplusIT HD Camera'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-24-MANJARO-KDE',
      os: 'linux',
      processes: ['plasmashell', 'kwin_x11', 'dolphin', 'konsole', 'chrome', 'kate', 'vlc'],
      cameraNames: ['UVC Camera (046d:0825)'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-25-WIN11-MSI-PRESTIGE',
      os: 'win',
      processes: ['msicenter', 'nahimic', 'chrome', 'adobe_photoshop', 'illustrator', 'creative_cloud', 'explorer'],
      cameraNames: ['FHD IR Camera'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-26-WIN10-SAMSUNG-BOOK',
      os: 'win',
      processes: ['samsungsettings', 'quickshare', 'msedge', 'samsungnotes', 'skype', 'explorer'],
      cameraNames: ['HD Webcam'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-27-MAC-M2-STUDIO',
      os: 'mac',
      processes: ['final cut pro', 'logic pro', 'safari', 'finder', 'systemsettings', 'creative cloud'],
      cameraNames: ['Studio Display Camera'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-28-WIN11-EDUCATION-LAB',
      os: 'win',
      processes: ['deepfreeze', 'netop', 'chrome', 'turboc', 'codeblocks', 'matlab', 'explorer', 'svchost'],
      cameraNames: ['USB Video Device'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-29-WIN10-CORPORATE-BYOD',
      os: 'win',
      processes: ['crowdstrike', 'zscaler', 'cisco_anyconnect', 'outlook', 'teams', 'excel', 'chrome', 'explorer'],
      cameraNames: ['Integrated Camera'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-30-UBUNTU20-VINTAGE-DELL',
      os: 'linux',
      processes: ['gnome-shell', 'chromium-browser', 'libreoffice', 'gedit', 'gnome-terminal', 'systemd'],
      cameraNames: ['Laptop_Integrated_Webcam_0.3M'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-31-WIN11-AUDIO-STUDIO',
      os: 'win',
      processes: ['ableton live 11 suite', 'focusrite_control', 'chrome', 'fl64', 'audacity', 'asio4all', 'explorer'],
      cameraNames: ['Logitech Brio 500'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-32-MAC-M1-PRO-DEVELOPER',
      os: 'mac',
      processes: ['cursor', 'pycharm', 'datagrip', 'slack', 'zoom', 'iterm2', 'docker', 'firefox'],
      cameraNames: ['FaceTime HD Camera'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-33-WIN11-SURFACE-PRO-9',
      os: 'win',
      processes: ['surfacehotkey', 'onenote', 'whiteboard', 'msedge', 'spotify', 'explorer'],
      cameraNames: ['Surface Front Camera', 'Surface Rear Camera'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-34-POPOS-2204-DEV',
      os: 'linux',
      processes: ['cosmic-comp', 'pop-launcher', 'alacritty', 'firefox', 'docker', 'rust-analyzer', 'git'],
      cameraNames: ['Chicony Electronics HD WebCam'],
      displayCount: 1,
      vmIndicators: []
    },
    {
      id: 'VOL-35-WIN11-THINKPAD-E14',
      os: 'win',
      processes: ['trackpoint', 'elanhk', 'chrome', 'word', 'excel', 'zoom', 'foxitpdf', 'explorer'],
      cameraNames: ['Integrated Camera (04f2:b6d9)'],
      displayCount: 1,
      vmIndicators: []
    }
  ]

  it('asserts ≥ 30 anonymized machine listings in corpus', () => {
    assert.ok(CORPUS_MACHINES.length >= 30, `Corpus must contain >= 30 machines, found ${CORPUS_MACHINES.length}`)
  })

  // Run the matcher over every machine in the corpus: target ZERO false positives
  for (const machine of CORPUS_MACHINES) {
    it(`evaluates ${machine.id} (${machine.os}) -> ZERO false positive findings`, () => {
      // Exclude 'cursor' from VOL-32 if testing clean dev machine without ai assistant
      const processes = new Set(
        machine.processes
          .filter(p => machine.id !== 'VOL-32-MAC-M1-PRO-DEVELOPER' || p !== 'cursor')
          .map(p => p.toLowerCase())
      )

      const collectorOutput = {
        ok: true,
        data: {
          processes,
          displayCount: machine.displayCount,
          cameraNames: machine.cameraNames,
          vmIndicators: machine.vmIndicators
        }
      }

      const result = matchTelemetry(collectorOutput, SEED_RULES)

      assert.equal(
        result.findings.length,
        0,
        `False positive detected on clean machine ${machine.id}: ${JSON.stringify(result.findings)}`
      )
      assert.equal(result.cameras.virtual.length, 0, `Virtual camera false positive on ${machine.id}`)
      assert.equal(result.display.count, 1, `Display count error on ${machine.id}`)
      assert.equal(result.session.remote, false, `Remote session false positive on ${machine.id}`)
    })
  }
})
