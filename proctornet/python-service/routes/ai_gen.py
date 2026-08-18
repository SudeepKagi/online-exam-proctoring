"""
ai_gen.py — AI Question Generator microservice endpoint.
Inspired by CBIT-AiExam-plus item generation engine.
"""

from flask import Blueprint, request, jsonify
import os
import json
import random

ai_gen_bp = Blueprint('ai_gen', __name__)

# Sample question templates for fallback intelligent generator
TOPIC_BANK = {
    "computer science": [
        {
            "questionText": "Which data structure uses LIFO (Last In First Out) principle?",
            "options": ["Queue", "Stack", "Array", "Linked List"],
            "correctOption": 1,
            "explanation": "Stack follows Last In First Out (LIFO) order."
        },
        {
            "questionText": "What is the worst-case time complexity of QuickSort?",
            "options": ["O(N log N)", "O(N)", "O(N^2)", "O(1)"],
            "correctOption": 2,
            "explanation": "QuickSort worst case is O(N^2) when pivot selection is poor."
        },
        {
            "questionText": "Which protocol is used for secure encrypted web traffic?",
            "options": ["HTTP", "HTTPS", "FTP", "SMTP"],
            "correctOption": 1,
            "explanation": "HTTPS uses SSL/TLS to encrypt HTTP communications."
        },
        {
            "questionText": "What does SQL stand for?",
            "options": ["Structured Query Language", "Sequential Query Logic", "Simple System Language", "Server Query Link"],
            "correctOption": 0,
            "explanation": "SQL stands for Structured Query Language."
        }
    ],
    "operating systems": [
        {
            "questionText": "What is a deadlock condition where processes wait infinitely?",
            "options": ["Mutual Exclusion", "Circular Wait", "Starvation", "Context Switch"],
            "correctOption": 1,
            "explanation": "Circular wait is one of Coffman's 4 conditions for deadlock."
        },
        {
            "questionText": "Which scheduling algorithm gives priority to shortest job?",
            "options": ["FCFS", "SJF", "Round Robin", "Multilevel Queue"],
            "correctOption": 1,
            "explanation": "SJF (Shortest Job First) selects the process with smallest CPU burst time."
        }
    ]
}

@ai_gen_bp.route('/generate-questions', methods=['POST'])
def generate_questions():
    """
    POST /api/ai/generate-questions
    Payload: { "topic": str, "difficulty": str, "count": int, "type": str }
    """
    try:
        data = request.get_json() or {}
        topic = data.get('topic', 'General Knowledge').strip()
        difficulty = data.get('difficulty', 'Medium')
        count = int(data.get('count', 5))
        q_type = data.get('type', 'MCQ')

        # Check if OpenAI API key is present in environment
        openai_key = os.environ.get('OPENAI_API_KEY')
        
        if openai_key:
            try:
                import openai
                client = openai.OpenAI(api_key=openai_key)
                prompt = (
                    f"Generate {count} multiple choice questions (MCQ) on the topic: '{topic}' at difficulty level '{difficulty}'. "
                    f"Format output as a valid JSON array of objects. Each object must have: "
                    f"'questionText' (str), 'options' (array of 4 strings), 'correctOption' (integer 0-3), and 'explanation' (str). "
                    f"Return ONLY raw JSON, no markdown formatting."
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
                return jsonify({"success": True, "source": "openai", "questions": questions})
            except Exception as e:
                print(f"[AIGen] OpenAI fallback triggered: {e}")

        # Fallback intelligent question builder
        topic_lower = topic.lower()
        matched_bank = None
        for key in TOPIC_BANK:
            if key in topic_lower or topic_lower in key:
                matched_bank = TOPIC_BANK[key]
                break

        if not matched_bank:
            matched_bank = [
                {
                    "questionText": f"What is a fundamental core concept of {topic}?",
                    "options": [f"Core Principle of {topic}", f"Secondary Rule", f"Deprecated Method", f"External Dependency"],
                    "correctOption": 0,
                    "explanation": f"Core Principle is fundamental to {topic}."
                },
                {
                    "questionText": f"Which of the following best describes optimal performance in {topic}?",
                    "options": ["High efficiency & accuracy", "Random execution", "Linear slowdown", "Unbounded memory usage"],
                    "correctOption": 0,
                    "explanation": f"High efficiency & accuracy are key quality metrics for {topic}."
                },
                {
                    "questionText": f"What is a common best practice when designing solutions in {topic}?",
                    "options": ["Modular and structured design", "Hardcoding parameters", "Ignoring error handling", "Global mutable state"],
                    "correctOption": 0,
                    "explanation": f"Modular design enhances maintainability and scalability in {topic}."
                }
            ]

        selected = []
        for i in range(count):
            base_q = matched_bank[i % len(matched_bank)]
            q_copy = dict(base_q)
            if i >= len(matched_bank):
                q_copy["questionText"] = f"[{difficulty}] {q_copy['questionText']} (Variant {i+1})"
            selected.append(q_copy)

        return jsonify({
            "success": True,
            "source": "smart_template",
            "questions": selected
        })

    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 500
