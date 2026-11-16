/**
 * ProctorNet Centralized UI Copy
 * Single source of truth for user-facing strings, labels, alerts, and instructions.
 * Strictly reflects current platform capabilities:
 * - Camera and facial verification (screen sharing removed)
 * - Safe Exam Browser (Windows kiosk lockdown) for secured exams
 * - Autosave and offline answer recovery
 * - Server-authoritative timer
 * - One-tab rule & violation limit (3 violations)
 * - Privacy and proctoring consent
 */

export const COPY = {
  brand: {
    name: 'ProctorNet',
    enterpriseBadge: 'Enterprise',
    tagline: 'Institutional Assessment Runtime',
    heroTitle: 'Online Examination & Proctoring Platform for Institutions',
    heroSubtitle:
      'A unified enterprise portal for administrators, faculty, invigilators, and students to conduct secure, resilient assessments.'
  },

  landing: {
    badge: 'Institutional Examination Platform • Production Ready',
    ctaPrimary: 'Open Examination Portal',
    ctaSignIn: 'Sign In',
    featuresHeading: 'Core Platform Capabilities',
    featuresSubheading: 'Quiet, precise evaluation infrastructure built on deterministic server authority.',
    features: [
      {
        title: 'Verified Onboarding',
        category: 'Identity Assurance',
        desc: 'Admin account provisioning with student biometric face enrollment and institutional verification.'
      },
      {
        title: 'Camera & Identity Verification',
        category: 'Session Security',
        desc: '1:1 facial comparison verification, continuous camera integrity checks, and privacy consent.'
      },
      {
        title: 'Exam Authoring & Instant Grading',
        category: 'Evaluation Engine',
        desc: '5-step AI wizard with PDF question extraction, custom scoring rules, and deterministic grading.'
      },
      {
        title: 'Live Invigilator Console',
        category: 'Real-Time Oversight',
        desc: 'Live candidate monitoring console, anomaly feeds, one-tab rule enforcement, and session control.'
      }
    ],
    workflowHeading: 'Step-by-Step Examination Flow',
    workflowSubheading: 'How institutions schedule, monitor, and deliver trusted evaluations.',
    workflowSteps: [
      {
        num: '01',
        title: 'Provision & Enroll Identity',
        desc: 'Administrators provision accounts; candidates enroll their facial identity baseline.'
      },
      {
        num: '02',
        title: 'Author & Schedule Assessments',
        desc: 'Faculty configure assessments via 5-step AI wizard, set start windows, and toggle secure browser lockdown.'
      },
      {
        num: '03',
        title: 'Identity & Integrity Verification',
        desc: 'Before the exam unlocks, students pass facial comparison, camera check, and secure kiosk validation.'
      },
      {
        num: '04',
        title: 'Monitored Arena & Autosave',
        desc: 'Exam runner autosaves answers with network drop resilience, server timer, and deterministic final scoring.'
      }
    ],
    rolesHeading: 'Tailored Portals for Every Stakeholder',
    rolesSubheading: 'Dedicated workflows built for administrators, faculty examiners, students, and proctors.',
    roles: [
      {
        role: 'STUDENT',
        name: 'Student Portal',
        desc: 'Biometric verification onboarding, resilient examination arena, and verified score reports.',
        route: '/login?role=student'
      },
      {
        role: 'FACULTY',
        name: 'Faculty Console',
        desc: '5-step AI assessment wizard, negative marking rules, and comprehensive submission inspection.',
        route: '/login?role=faculty'
      },
      {
        role: 'INVIGILATOR',
        name: 'Proctor Station',
        desc: 'Live candidate monitoring console, real-time violation event feeds, and session management.',
        route: '/login?role=invigilator'
      },
      {
        role: 'ADMIN',
        name: 'Administrative Suite',
        desc: 'Manage institutional accounts, configure Safe Exam Browser policies, and inspect audit logs.',
        route: '/login?role=admin'
      }
    ]
  },

  student: {
    preCheck: {
      title: 'Pre-Examination Verification',
      consentTitle: 'Examination Privacy & Proctoring Consent',
      consentBadge: 'Privacy & Consent',
      verifiedBadge: 'System & Identity Check',
      consentNotice: 'Please review how your data is processed and protected during this assessment',
      consentCheckbox:
        'I understand and consent to identity verification snapshots and proctoring logs being captured and retained for this exam session.',
      agreeButton: 'Agree & Continue to Verification',
      recordingConsent: 'Recording Consent...',
      whatIsCapturedTitle: 'What is captured',
      whatIsCapturedDesc:
        'Periodic camera snapshots during testing, 1:1 algorithmic facial verification matching against your enrolled student photo, and automated anomaly logs (absence of face, window switches).',
      accessTitle: 'Who can access this data',
      accessDesc:
        'Strictly authorized course faculty, assigned proctors, and academic administrators. No data is shared with external commercial entities.',
      retentionTitle: 'Retention period',
      retentionDesc:
        'All proctoring snapshots and session telemetry are automatically and permanently purged 90 days after assessment results are released.',
      cameraBlockedTitle: 'Camera access needed',
      cameraBlockedInstructions: [
        'Click the camera or lock icon in your browser address bar.',
        'Set camera permission to Allow.',
        'Ensure no other application (Zoom, Teams, Meet) is using your webcam.'
      ],
      tryCameraAgain: 'Try camera again',
      framesArriving: 'Frames arriving',
      connectingFeed: 'Connecting feed...',
      stageFaceMatch: '1. Face Match',
      stageFullscreenLock: '2. Fullscreen Lock',
      sebVerifiedBadge: 'Secure browser verified'
    },

    instructions: {
      title: 'Candidate Instructions & Code of Conduct',
      rules: [
        {
          title: 'Active Camera Requirement',
          desc: 'Your webcam must remain continuously active and your face fully visible in the frame throughout the entire session.'
        },
        {
          title: 'One-Tab & Application Lock',
          desc: 'Navigating away from the examination window, minimizing the screen, or opening new tabs or applications is recorded as a security violation.'
        },
        {
          title: 'Server-Authoritative Countdown',
          desc: 'The examination countdown is calculated strictly by the institutional server clock. When time expires, answers are automatically submitted.'
        },
        {
          title: 'Network Resilience & Autosave',
          desc: 'Your answers autosave continuously. If your network connection drops, answers are saved offline on your device and synchronized as soon as connectivity resumes.'
        },
        {
          title: 'Violation Threshold & Session Termination',
          desc: 'A maximum limit of 3 violations is enforced. Exceeding this limit terminates your examination session immediately.'
        }
      ]
    },

    seb: {
      title: 'Safe Exam Browser Required',
      badge: 'Kiosk Lockdown Required',
      description: 'Standard web browsers are restricted for this exam. Safe Exam Browser locks your computer into a secure kiosk mode, disabling unauthorized applications, secondary monitors, and shortcuts during the session.',
      openInSeb: 'Open in Safe Exam Browser',
      downloadSeb: 'Download Safe Exam Browser',
      mobileWarning:
        'This assessment requires Safe Exam Browser on a Windows PC or laptop. Mobile phones, tablets, and unsupported operating systems cannot run this secured examination.',
      mobileAlertTitle: 'Desktop Computer Required'
    },

    arena: {
      offlineBanner: 'Connection interrupted. Answers are stored locally and will sync once connectivity returns.',
      syncSuccess: 'All answers synchronized with server',
      submitting: 'Submitting assessment...',
      autoSubmittedNotice: 'Time has expired. Your examination was automatically submitted.',
      exitPrompt: 'Are you sure you want to finish and submit your exam? You cannot re-enter once submitted.'
    }
  },

  faculty: {
    wizard: {
      title: 'Create Assessment',
      stepUpload: 'Upload Material',
      stepAIReview: 'Questions & Answers',
      stepSchedule: 'Window & Timing',
      stepSecurity: 'Security & Integrity',
      stepReview: 'Review & Publish'
    }
  },

  errors: {
    boundaryTitle: 'Something unexpected occurred',
    boundarySubtitle:
      'The examination runtime encountered an unhandled exception. Your saved answers remain securely persisted.',
    referenceIdLabel: 'Error Reference ID',
    reloadButton: 'Reload Screen',
    dashboardButton: 'Return to Dashboard',
    pageNotFoundTitle: 'Page Not Found',
    pageNotFoundSubtitle: 'The requested examination resource or page does not exist or has been relocated.',
    pageNotFoundButton: 'Back to Home'
  }
}

export default COPY
