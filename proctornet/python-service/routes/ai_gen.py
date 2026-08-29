"""
ai_gen.py — AI Question Generator microservice endpoint.
Enhanced with domain-rich intelligent question banks, NLP text extraction cleaner,
and OpenAI GPT integration fallback.
"""

from flask import Blueprint, request, jsonify
import os
import json
import random
import re

ai_gen_bp = Blueprint('ai_gen', __name__)

def clean_extracted_text(raw_text: str) -> str:
    """
    Cleans extracted PDF text by repairing glyph-spaced words
    (e.g., 't i t l e :   N a m a s t e   J a v a S c r i p t' -> 'title: Namaste JavaScript')
    and stripping PDF formatting artifacts.
    """
    if not raw_text or not isinstance(raw_text, str):
        return "General Subject"

    # Strip PDF binary junk and non-printable control characters
    text = re.sub(r'[^\x20-\x7E\n\t]', ' ', raw_text)

    # Repair single spaced characters: \b([a-zA-Z])\s+([a-zA-Z])\b
    # e.g., 'J a v a S c r i p t' -> 'JavaScript'
    for _ in range(5):
        text = re.sub(r'(?<=\b[a-zA-Z])\s+(?=[a-zA-Z]\b)', '', text)

    # Normalize multiple whitespace and line breaks
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n\s*\n', '\n\n', text)
    return text.strip()

def sanitize_topic(raw_topic: str) -> str:
    """
    Extracts a concise, clean subject title from the input text.
    """
    cleaned = clean_extracted_text(raw_topic)
    
    # Strip common repetitive prefixes
    for prefix in ["what is a fundamental core concept of", "what is a core concept of", "what is", "title:", "topic:"]:
        if cleaned.lower().startswith(prefix):
            cleaned = cleaned[len(prefix):].strip()

    if not cleaned:
        return "Computer Science & Engineering"

    # Extract first non-empty line or truncate cleanly
    first_line = cleaned.split('\n')[0].strip()
    if len(first_line) > 60:
        first_line = first_line[:55].rsplit(' ', 1)[0] + "..."
    return first_line

# ── EXPANSIVE TOPIC QUESTION BANKS ─────────────────────────────────────────
TOPIC_BANK = {
    "javascript": [
        {
            "questionText": "What is created when a JavaScript function is invoked in the Execution Context?",
            "options": ["A new Variable Environment and Scope Chain", "A global DOM window", "A separate thread in the OS", "A static prototype class"],
            "correctOption": 0,
            "explanation": "Every function invocation in JS creates a new Execution Context with its own Variable Environment and Lexical Environment."
        },
        {
            "questionText": "What is the Temporal Dead Zone (TDZ) in JavaScript?",
            "options": [
                "The state between entering scope and variable declaration using let or const",
                "The time taken by Garbage Collection to free heap memory",
                "The delay before setTimeout callback is pushed to call stack",
                "The duration when Event Loop pauses for microtasks"
            ],
            "correctOption": 0,
            "explanation": "Variables declared with let and const are in the Temporal Dead Zone from the start of the block until the declaration is evaluated."
        },
        {
            "questionText": "Which of the following describes a Closure in JavaScript?",
            "options": [
                "A function bundled together with references to its lexical environment",
                "A syntax error caused by unclosed parentheses",
                "A built-in method to terminate asynchronous Web Workers",
                "A mechanism to seal objects against property modification"
            ],
            "correctOption": 0,
            "explanation": "A closure gives a function access to its outer scope even after the outer function has finished executing."
        },
        {
            "questionText": "How does the JavaScript Event Loop prioritize Task Queues?",
            "options": [
                "Microtasks (Promises, MutationObserver) take precedence over Macrotasks (setTimeout)",
                "Macrotasks take priority over Microtasks",
                "Tasks are executed randomly based on memory availability",
                "The call stack only executes setTimeout callbacks directly"
            ],
            "correctOption": 0,
            "explanation": "The Microtask queue has higher priority than the Callback (Macrotask) queue in the JavaScript runtime event loop."
        },
        {
            "questionText": "What is the default value of variables declared with 'var' during the Creation Phase of execution context?",
            "options": ["undefined", "null", "ReferenceError", "0"],
            "correctOption": 0,
            "explanation": "During the memory allocation phase, 'var' variables are hoisted and initialized to undefined."
        },
        {
            "questionText": "Which statement correctly describes Higher-Order Functions in JavaScript?",
            "options": [
                "Functions that take other functions as arguments or return a function",
                "Functions with high CPU execution overhead",
                "Functions only available in the Global Window scope",
                "Functions that run asynchronously using multi-threading"
            ],
            "correctOption": 0,
            "explanation": "A Higher-Order function is a function that accepts another function as an argument, returns a function, or both."
        }
    ],
    "web": [
        {
            "questionText": "Which HTTP status code signifies that a requested resource was not found on the server?",
            "options": ["404 Not Found", "200 OK", "500 Internal Server Error", "403 Forbidden"],
            "correctOption": 0,
            "explanation": "HTTP 404 indicates that the origin server did not find a current representation for the target resource."
        },
        {
            "questionText": "What is the primary purpose of Cross-Origin Resource Sharing (CORS)?",
            "options": [
                "To allow servers to specify which origins are permitted to access their resources",
                "To compress image assets transferred over HTTP",
                "To enforce client-side password hashing",
                "To speed up DNS lookups for third-party scripts"
            ],
            "correctOption": 0,
            "explanation": "CORS uses HTTP headers to tell browsers whether a web application running at one origin can request resources from a different origin."
        },
        {
            "questionText": "Which protocol provides real-time, bidirectional full-duplex communication between client and server?",
            "options": ["WebSocket", "HTTP/1.0", "RESTful Polling", "SMTP"],
            "correctOption": 0,
            "explanation": "WebSocket provides a persistent full-duplex TCP connection for real-time messaging."
        }
    ],
    "data structures": [
        {
            "questionText": "Which data structure follows the Last In, First Out (LIFO) order?",
            "options": ["Stack", "Queue", "Priority Queue", "Circular Buffer"],
            "correctOption": 0,
            "explanation": "A Stack operates on a LIFO (Last In First Out) basis, where the last element inserted is the first removed."
        },
        {
            "questionText": "What is the average and worst-case time complexity of searching in a Balanced Binary Search Tree (AVL / Red-Black)?",
            "options": ["O(log N)", "O(N)", "O(1)", "O(N^2)"],
            "correctOption": 0,
            "explanation": "Self-balancing binary search trees maintain height bounded by O(log N), guaranteeing O(log N) search."
        },
        {
            "questionText": "Which sorting algorithm has a guaranteed worst-case time complexity of O(N log N)?",
            "options": ["Merge Sort", "Quick Sort", "Bubble Sort", "Insertion Sort"],
            "correctOption": 0,
            "explanation": "Merge Sort consistently divides the array and combines sorted halves in O(N log N) time in all cases."
        },
        {
            "questionText": "Which data structure uses key-value hashing to provide amortized O(1) average lookup time?",
            "options": ["Hash Table / HashMap", "Linked List", "Binary Heap", "Trie"],
            "correctOption": 0,
            "explanation": "Hash Tables use a hash function to map keys to bucket indices, achieving average O(1) lookup."
        }
    ],
    "database": [
        {
            "questionText": "In relational databases, what does the 'I' in the ACID transaction model stand for?",
            "options": ["Isolation", "Integrity", "Iteration", "Indexing"],
            "correctOption": 0,
            "explanation": "ACID stands for Atomicity, Consistency, Isolation, and Durability."
        },
        {
            "questionText": "Which SQL statement is used to combine rows from two or more tables based on a related column?",
            "options": ["JOIN", "UNION", "GROUP BY", "WHERE"],
            "correctOption": 0,
            "explanation": "JOIN clauses are used in SQL to combine rows from multiple tables based on common relational keys."
        },
        {
            "questionText": "What is the primary benefit of adding a B-Tree Index to a database table column?",
            "options": [
                "Accelerates SELECT query lookups from O(N) full-table scan to O(log N)",
                "Reduces disk space required by the database",
                "Encrypts data rows against unauthorized reading",
                "Automatically resolves duplicate records"
            ],
            "correctOption": 0,
            "explanation": "Indexes speed up data retrieval queries by creating balanced hierarchical lookup trees."
        }
    ],
    "operating systems": [
        {
            "questionText": "Which of the following is NOT one of Coffman's four necessary conditions for Deadlock?",
            "options": ["Preemption Allowed", "Mutual Exclusion", "Hold and Wait", "Circular Wait"],
            "correctOption": 0,
            "explanation": "Deadlock requires No Preemption. If preemption is allowed, deadlock cannot occur."
        },
        {
            "questionText": "What mechanism allows an operating system to allocate more memory to processes than physically available in RAM?",
            "options": ["Virtual Memory & Paging", "Context Switching", "DMA Controller", "Bus Mastering"],
            "correctOption": 0,
            "explanation": "Virtual Memory maps secondary storage (page files/swap) into physical address space via paging."
        },
        {
            "questionText": "Which CPU scheduling algorithm prevents starvation by allocating fixed time quantum slices to each process?",
            "options": ["Round Robin", "First-Come First-Served", "Shortest Job First", "Priority Non-Preemptive"],
            "correctOption": 0,
            "explanation": "Round Robin ensures fair CPU sharing across all ready processes using cyclical time quanta."
        }
    ],
    "computer science": [
        {
            "questionText": "Which layer of the OSI model is responsible for end-to-end reliable transmission and flow control?",
            "options": ["Transport Layer", "Network Layer", "Data Link Layer", "Session Layer"],
            "correctOption": 0,
            "explanation": "The Transport Layer (Layer 4) handles reliable data transfer, flow control, and error recovery (e.g., TCP)."
        },
        {
            "questionText": "What does the Principle of Least Privilege dictate in software security architecture?",
            "options": [
                "Every module or user must be granted only the minimal permissions necessary to perform its job",
                "All users should have administrative privileges by default",
                "Passwords must never exceed 8 characters",
                "Network ports should remain open for maximum interoperability"
            ],
            "correctOption": 0,
            "explanation": "Least Privilege minimizes potential exploit damage by restricting access rights to essential resources only."
        }
    ],
    "networking": [
        {
            "questionText": "In TCP congestion control, which algorithm is triggered immediately when three duplicate ACKs are received?",
            "options": ["Fast Retransmit & Fast Recovery", "Slow Start Threshold Reset", "Exponential Backoff Wait", "Random Early Detection"],
            "correctOption": 0,
            "explanation": "Three duplicate ACKs indicate packet loss without timeout, triggering Fast Retransmit and transitioning to Fast Recovery."
        },
        {
            "questionText": "What is the primary function of the Address Resolution Protocol (ARP)?",
            "options": [
                "Map a known 32-bit IPv4 address to a 48-bit physical MAC address",
                "Translate domain names into routable public IP addresses",
                "Encrypt payloads at the Transport layer using TLS certificates",
                "Assign dynamic IP leases to host interfaces via DHCP"
            ],
            "correctOption": 0,
            "explanation": "ARP resolves IP addresses to physical MAC addresses on local broadcast network segments."
        },
        {
            "questionText": "Which protocol operates over UDP port 53 to provide hierarchical name resolution?",
            "options": ["DNS (Domain Name System)", "HTTP", "SNMP", "BGP"],
            "correctOption": 0,
            "explanation": "DNS uses UDP port 53 for standard recursive and iterative query lookups."
        },
        {
            "questionText": "What distinguishes symmetric encryption from asymmetric encryption in network security protocols?",
            "options": [
                "Symmetric uses a single shared secret key, while asymmetric uses a mathematically linked public-private key pair",
                "Symmetric is only used for analog data transmission",
                "Asymmetric encryption requires no key exchange mechanism",
                "Symmetric encryption is significantly slower than asymmetric algorithms like RSA"
            ],
            "correctOption": 0,
            "explanation": "Symmetric algorithms (like AES) utilize one shared key for encryption/decryption, whereas asymmetric (RSA/ECC) uses keypairs."
        }
    ],
    "software engineering": [
        {
            "questionText": "Which architectural pattern decouples presentation, business logic, and database persistence layers?",
            "options": ["Model-View-Controller (MVC)", "Monolithic Scripting", "Direct Hardware Binding", "Single-Page Spaghetti"],
            "correctOption": 0,
            "explanation": "MVC isolates data models, user interface views, and input controllers into distinct decoupled components."
        },
        {
            "questionText": "What does the 'S' represent in the SOLID principles of Object-Oriented Design?",
            "options": [
                "Single Responsibility Principle — A class should have one, and only one, reason to change",
                "State Isolation Principle",
                "Static Binding Rule",
                "Synchronous Execution Requirement"
            ],
            "correctOption": 0,
            "explanation": "Single Responsibility Principle dictates that each module, class, or function should hold responsibility over a single part of software functionality."
        },
        {
            "questionText": "In software testing, what is the primary objective of Regression Testing?",
            "options": [
                "Verifying that recent code changes or bug fixes have not adversely affected existing functional features",
                "Benchmarking peak load capacity under DDOS conditions",
                "Checking syntactic code style against linter rules",
                "Compiling source binaries across target CPU architectures"
            ],
            "correctOption": 0,
            "explanation": "Regression testing ensures previously tested and deployed software continues to perform correctly after updates."
        },
        {
            "questionText": "Which Git workflow command creates an isolated, atomic commit that reverts the exact changes made in a previous commit?",
            "options": ["git revert <commit-hash>", "git reset --hard", "git purge", "git branch -D"],
            "correctOption": 0,
            "explanation": "git revert creates a new forward commit that inverses the changes of the specified commit without rewriting history."
        }
    ],
    "python": [
        {
            "questionText": "What is the key difference between a Python List and a Python Tuple?",
            "options": [
                "Lists are mutable and dynamically resizable, whereas Tuples are immutable",
                "Tuples cannot contain heterogeneous data types",
                "Lists use parentheses () while tuples use brackets []",
                "Tuples consume more memory than lists for identical elements"
            ],
            "correctOption": 0,
            "explanation": "Lists are mutable sequences, while Tuples cannot be modified after instantiation, making them hashable and memory-efficient."
        },
        {
            "questionText": "How does the Python Global Interpreter Lock (GIL) affect multi-threaded CPU-bound programs?",
            "options": [
                "It restricts bytecode execution to one native thread at a time, limiting true parallel CPU scaling",
                "It automatically distributes loops across GPU tensor cores",
                "It disables memory garbage collection permanently",
                "It forces all I/O network operations to run synchronously"
            ],
            "correctOption": 0,
            "explanation": "CPython's GIL prevents multiple threads from executing Python bytecodes concurrently on multi-core processors."
        }
    ]
}

def generate_topic_questions(clean_topic: str, difficulty: str, count: int):
    """
    Synthesizes contextual questions matching keywords in the clean topic,
    or constructs professional conceptual questions without broken placeholder strings.
    """
    topic_lower = clean_topic.lower()
    matched_questions = []

    # 1. Match specific topic banks
    if any(k in topic_lower for k in ["javascript", "js", "namaste", "script", "node", "ecma", "frontend"]):
        matched_questions.extend(TOPIC_BANK["javascript"])
    if any(k in topic_lower for k in ["web", "http", "api", "html", "css", "cors", "rest", "browser"]):
        matched_questions.extend(TOPIC_BANK["web"])
    if any(k in topic_lower for k in ["data structure", "algorithm", "dsa", "tree", "sort", "stack", "queue", "array", "graph", "search"]):
        matched_questions.extend(TOPIC_BANK["data structures"])
    if any(k in topic_lower for k in ["db", "database", "sql", "relational", "query", "schema", "table", "acid"]):
        matched_questions.extend(TOPIC_BANK["database"])
    if any(k in topic_lower for k in ["os", "operating system", "process", "thread", "memory", "deadlock", "scheduling", "paging"]):
        matched_questions.extend(TOPIC_BANK["operating systems"])
    if any(k in topic_lower for k in ["network", "osi", "tcp", "udp", "ip", "dns", "arp", "packet"]):
        matched_questions.extend(TOPIC_BANK.get("networking", []))
    if any(k in topic_lower for k in ["software", "engineering", "mvc", "solid", "git", "test", "agile", "architecture"]):
        matched_questions.extend(TOPIC_BANK.get("software engineering", []))
    if any(k in topic_lower for k in ["python", "py", "gil", "tuple", "list", "dict"]):
        matched_questions.extend(TOPIC_BANK.get("python", []))

    # Fallback / aggregation to ensure at least 30 diverse questions available
    all_banks = []
    for bank in TOPIC_BANK.values():
        all_banks.extend(bank)

    if not matched_questions or len(matched_questions) < count:
        matched_questions.extend([q for q in all_banks if q not in matched_questions])

    # Shuffle to provide variety
    random.seed((hash(clean_topic) + hash(difficulty)) % 100000)
    pool = list(matched_questions)
    random.shuffle(pool)

    diff_str = str(difficulty).upper() if difficulty else 'MEDIUM'
    marks = 3 if diff_str == 'HARD' else (2 if diff_str == 'MEDIUM' else 1)

    output = []
    for i in range(count):
        base_q = pool[i % len(pool)]
        correct_idx = base_q.get("correctOption", 0)
        q_item = {
            "type": "MCQ",
            "questionText": base_q["questionText"],
            "options": list(base_q["options"]),
            "correctOption": correct_idx,
            "correctAnswer": chr(65 + correct_idx),
            "difficulty": diff_str,
            "marks": marks,
            "explanation": base_q.get("explanation", "Standard core concept.")
        }
        output.append(q_item)

    return output

@ai_gen_bp.route('/generate-questions', methods=['POST'])
def generate_questions():
    """
    POST /api/ai/generate-questions
    Payload: { "topic": str, "difficulty": str, "count": int, "type": str }
    """
    try:
        data = request.get_json() or {}
        raw_topic = str(data.get('topic', 'Computer Science')).strip()
        difficulty = str(data.get('difficulty', 'Medium'))
        count = int(data.get('count') or data.get('numMCQ') or 5)
        q_type = str(data.get('type', 'MCQ')).upper()

        # Clean and repair any spaced text
        cleaned_topic = clean_extracted_text(raw_topic)
        topic_title = sanitize_topic(cleaned_topic)

        # Check OpenAI key in environment
        openai_key = os.environ.get('OPENAI_API_KEY')
        if openai_key:
            try:
                import openai
                client = openai.OpenAI(api_key=openai_key)
                prompt = (
                    f"You are an academic examination question author. "
                    f"Generate {count} multiple choice questions (MCQ) for the subject/syllabus material below at difficulty level '{difficulty}'.\n\n"
                    f"Topic Material:\n{cleaned_topic[:2000]}\n\n"
                    f"Format output as a valid JSON array of objects. Each object must have:\n"
                    f"- 'questionText' (string with clear, grammatically correct question)\n"
                    f"- 'type' ('MCQ')\n"
                    f"- 'options' (array of 4 distinct, plausible string choices)\n"
                    f"- 'correctOption' (integer index 0-3 indicating the correct choice)\n"
                    f"- 'correctAnswer' (string 'A', 'B', 'C', or 'D')\n"
                    f"- 'difficulty' ('{difficulty}')\n"
                    f"- 'explanation' (string explanation)\n"
                    f"Return ONLY valid raw JSON."
                )
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7
                )
                raw_content = response.choices[0].message.content.strip()
                if raw_content.startswith("```"):
                    raw_content = raw_content.split("\n", 1)[1].rsplit("\n", 1)[0]
                questions = json.loads(raw_content)
                for q in questions:
                    q['type'] = q.get('type', 'MCQ')
                    if 'correctOption' in q and 'correctAnswer' not in q:
                        q['correctAnswer'] = chr(65 + int(q['correctOption']))
                return jsonify({"success": True, "source": "openai", "questions": questions})
            except Exception as e:
                print(f"[AIGen] OpenAI API notice: {e}")

        # Intelligent Fallback Engine
        questions = generate_topic_questions(topic_title, difficulty, count)
        return jsonify({
            "success": True,
            "source": "smart_curated_bank",
            "topic": topic_title,
            "questions": questions
        })

    except Exception as err:
        print(f"[AIGen] Error: {err}")
        return jsonify({"success": False, "error": str(err)}), 500
