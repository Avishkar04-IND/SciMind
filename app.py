# -*- coding: utf-8 -*-
"""
IBM Watsonx.ai - AI-Powered Scientific Research Agent
Backend: Flask + IBM Granite Model
"""

import os
import re
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams

# === Load environment variables ===
load_dotenv()

# ===
# ===                      AGENT INSTRUCTIONS                                  ===
# ===  Customize the agent's persona, tone, specialization, and rules here.   ===
# ===  These instructions are prepended to every model prompt automatically.  ===
# ===
AGENT_INSTRUCTIONS = """
You are SciMind - an advanced AI-powered Scientific Research Assistant built on IBM Granite.

===
 PERSONA & TONE
===
- Communicate with precision, clarity, and academic professionalism.
- Be concise yet thorough; use structured formatting (headers, bullet points, numbered lists).
- Adapt explanation depth to context: technical for experts, simplified for students.
- Maintain a neutral, evidence-based, and objective tone at all times.
- Avoid speculation beyond established scientific consensus unless explicitly asked for hypotheses.

===
 SCIENTIFIC SPECIALIZATIONS (Primary Domains)
===
1.  Physics            - Quantum Mechanics, Astrophysics, Thermodynamics, Particle Physics
2.  Chemistry          - Organic, Inorganic, Biochemistry, Physical Chemistry
3.  Biology            - Molecular Biology, Genetics, Ecology, Evolutionary Biology
4.  Mathematics        - Pure Math, Applied Math, Statistics, Topology
5.  Computer Science   - AI/ML, Algorithms, Cybersecurity, Distributed Systems
6.  Earth Sciences     - Geology, Climatology, Oceanography, Geophysics
7.  Space & Astronomy  - Cosmology, Planetary Science, Astrobiology, Observational Astronomy
8.  Engineering        - Aerospace, Mechanical, Electrical, Materials Science
9.  Environmental Sci  - Sustainability, Climate Change, Conservation Biology
10. Neuroscience       - Cognitive Science, Neuroimaging, Computational Neuroscience

===
 CORE CAPABILITIES
===
- Summarize and abstract scientific papers with key findings and methodology
- Build structured literature reviews (introduction -> methodology -> findings -> gaps)
- Generate APA, IEEE, Nature, and Science style citations
- Suggest novel research hypotheses and identify research gaps
- Extract key findings, experimental methodologies, and conclusions
- Recommend related journals, conferences, and seminal papers
- Explain complex concepts using analogies and progressive disclosure
- Draft paper sections: abstract, introduction, methodology, results, conclusion
- Analyze experimental data and propose statistical/analytical interpretations
- Compare scientific theories, models, and competing paradigms

===
 RESPONSE FORMAT RULES
===
- Always use Markdown formatting in responses.
- Structure long responses with clear ## Section Headers.
- Use **bold** for key terms and findings.
- Use numbered lists for methodological steps.
- Use bullet points for features, pros/cons, or lists.
- For citations, use exact specified format (APA/IEEE/Nature/Science).
- Always include a "Key Takeaways" section at the end of literature reviews.
- When drafting paper sections, clearly label each section.

===
 SAFETY & ETHICS RULES
===
- Never fabricate citations, author names, DOIs, or journal names.
- Clearly label all generated hypotheses as "Suggested Hypothesis (unverified)".
- When uncertain, state uncertainty explicitly rather than guessing.
- Do not assist with research that violates ethical guidelines (e.g., harmful experiments).
- Encourage proper citation and academic integrity in all research outputs.
- Flag any scientifically contested claims and present multiple perspectives.
- Respect intellectual property; do not reproduce copyrighted full-text papers verbatim.
- Only answer questions related to these 10 scientific domains: Physics, Chemistry, Biology, Mathematics, Computer Science, Earth Sciences, Space & Astronomy, Engineering, Environmental Science, and Neuroscience. Refuse all other topics politely.
- If asked anything outside science or research, respond exactly: "I'm SciMind, a Scientific Research Assistant. I can only help with scientific and academic research questions. Please ask me something related to science or research! 🔬"
- Never answer questions about cooking, sports, politics, celebrities, movies, music, food, travel, relationships, or any non-scientific daily life topics.


===
 TOPIC PREFERENCES (Emphasize in recommendations)
===
- Emerging interdisciplinary research (e.g., quantum biology, neuro-AI)
- Open-access and reproducible research methodologies
- Climate and sustainability science
- AI/ML applications across scientific domains
- Recent breakthroughs (within the last 5 years where possible)
"""

# === Flask app setup ===
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "scimind-secret-2024")
app.config["SESSION_TYPE"] = "filesystem"
CORS(app, supports_credentials=True)

# =============================================================================
#  DOMAIN CONFIGURATION
#  All valid scientific domains and their canonical keywords/subtopics.
#  Extend this dict to add or restrict domains.
# =============================================================================
DOMAIN_CONFIG = {
    "Physics": {
        "emoji": "⚛️",
        "subtopics": [
            "quantum", "mechanics", "thermodynamics", "optics", "electromagnetism",
            "relativity", "astrophysics", "nuclear", "particle", "wave", "force",
            "energy", "matter", "field theory", "condensed matter", "plasma",
            "photon", "electron", "entropy", "momentum", "gravity",
        ],
    },
    "Chemistry": {
        "emoji": "🧪",
        "subtopics": [
            "organic", "inorganic", "biochemistry", "physical chemistry", "polymer",
            "reaction", "molecule", "compound", "element", "bond", "acid", "base",
            "catalyst", "synthesis", "spectroscopy", "thermochemistry", "electrochemistry",
            "stoichiometry", "oxidation", "reduction", "enzyme",
        ],
    },
    "Biology": {
        "emoji": "🧬",
        "subtopics": [
            "cell", "genetics", "dna", "rna", "protein", "evolution", "ecology",
            "organism", "species", "mutation", "gene", "photosynthesis", "respiration",
            "metabolism", "enzyme", "taxonomy", "biodiversity", "microbiology",
            "virology", "immunology", "neurobiology",
        ],
    },
    "Mathematics": {
        "emoji": "📐",
        "subtopics": [
            "algebra", "calculus", "geometry", "topology", "statistics", "probability",
            "number theory", "differential", "integral", "matrix", "vector", "proof",
            "theorem", "equation", "function", "analysis", "combinatorics", "graph theory",
            "linear", "stochastic",
        ],
    },
    "Computer Science": {
        "emoji": "💻",
        "subtopics": [
            "algorithm", "machine learning", "artificial intelligence", "neural network",
            "deep learning", "data structure", "programming", "compiler", "operating system",
            "database", "networking", "cybersecurity", "cryptography", "distributed",
            "cloud", "software", "hardware", "quantum computing", "nlp", "computer vision",
        ],
    },
    "Earth Sciences": {
        "emoji": "🌍",
        "subtopics": [
            "geology", "geophysics", "seismology", "mineralogy", "plate tectonics",
            "erosion", "stratigraphy", "oceanography", "climatology", "meteorology",
            "hydrology", "soil", "volcano", "earthquake", "rock", "fossil",
            "atmosphere", "lithosphere", "mantle",
        ],
    },
    "Space & Astronomy": {
        "emoji": "🔭",
        "subtopics": [
            "star", "galaxy", "black hole", "cosmology", "planet", "asteroid",
            "comet", "telescope", "spectroscopy", "dark matter", "dark energy",
            "big bang", "supernova", "quasar", "nebula", "orbit", "exoplanet",
            "astrobiology", "space mission", "gravitational wave",
        ],
    },
    "Engineering Sciences": {
        "emoji": "⚙️",
        "subtopics": [
            "mechanical", "electrical", "aerospace", "civil", "chemical engineering",
            "materials", "structural", "thermodynamic", "fluid dynamics", "robotics",
            "control system", "signal processing", "semiconductor", "nanotechnology",
            "manufacturing", "embedded", "sensor", "actuator", "turbine",
        ],
    },
    "Environmental Science": {
        "emoji": "🌱",
        "subtopics": [
            "climate change", "pollution", "sustainability", "ecosystem", "carbon",
            "greenhouse", "renewable energy", "conservation", "biodiversity", "habitat",
            "deforestation", "ozone", "acid rain", "waste management", "water quality",
            "soil contamination", "environmental policy", "ecology",
        ],
    },
    "Neuroscience": {
        "emoji": "🧠",
        "subtopics": [
            "brain", "neuron", "synapse", "cognition", "memory", "neuroplasticity",
            "mri", "eeg", "consciousness", "perception", "neural circuit",
            "dopamine", "serotonin", "cortex", "hippocampus", "cerebellum",
            "psychiatric", "neurological", "behavior", "learning",
        ],
    },
    "General Science": {
        "emoji": "🔬",
        "subtopics": [],   # no restriction — accept any scientific question
    },
}

# Non-scientific keywords — fast-path rejection before any AI call.
# Extend this list as needed.
_OUT_OF_SCOPE_KEYWORDS = [
    "recipe", "cooking", "food", "restaurant", "chef",
    "cricket", "football", "soccer", "basketball", "tennis", "sport",
    "movie", "film", "actor", "actress", "celebrity", "singer", "album",
    "politics", "politician", "election", "government", "party",
    "fashion", "clothing", "makeup", "beauty", "skincare",
    "travel", "hotel", "vacation", "tourism", "flight booking",
    "relationship", "love", "dating", "marriage", "breakup",
    "joke", "meme", "funny", "prank",
    "stock market", "investment", "crypto", "bitcoin", "forex",
    "astrology", "horoscope", "zodiac",
]

# === Watsonx.ai configuration ===
IBM_API_KEY       = os.getenv("IBM_API_KEY")
WATSONX_PROJECT_ID = os.getenv("WATSONX_PROJECT_ID")
WATSONX_URL       = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
GRANITE_MODEL_ID  = os.getenv("GRANITE_MODEL_ID", "ibm/granite-4-h-small")
MAX_NEW_TOKENS    = int(os.getenv("MAX_NEW_TOKENS", 2048))
TEMPERATURE       = float(os.getenv("TEMPERATURE", 0.7))
TOP_P             = float(os.getenv("TOP_P", 0.95))

# === Build Watsonx model client ===
def get_model() -> ModelInference:
    """Return a ModelInference client using the chat API."""
    params = {
        GenParams.MAX_NEW_TOKENS: MAX_NEW_TOKENS,
        GenParams.TEMPERATURE:    TEMPERATURE,
        GenParams.TOP_P:          TOP_P,
    }
    return ModelInference(
        model_id=GRANITE_MODEL_ID,
        params=params,
        credentials=Credentials(url=WATSONX_URL, api_key=IBM_API_KEY),
        project_id=WATSONX_PROJECT_ID,
    )

# === Chat message builders ===
def build_messages(system_context: str, user_message: str, history: list = None) -> list:
    """
    Build an OpenAI-compatible messages list for the Watsonx chat API.
    system_context is appended to AGENT_INSTRUCTIONS in the system role.
    """
    history = history or []
    messages = [
        {"role": "system", "content": f"{AGENT_INSTRUCTIONS}\n{system_context}".strip()}
    ]
    for turn in history:
        role = turn.get("role", "user")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_message})
    return messages

def call_model(system_context: str, user_message: str, history: list = None) -> str:
    """Call the Watsonx model via the chat API and return the assistant reply."""
    try:
        model    = get_model()
        messages = build_messages(system_context, user_message, history)
        response = model.chat(messages=messages)
        return response["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        return f"Model error: {str(exc)}"


# =============================================================================
#  DOMAIN-AWARE CHAT HELPERS
# =============================================================================

def _keyword_out_of_scope(message: str) -> bool:
    """
    Fast keyword pre-filter.  Returns True if the message is obviously
    non-scientific so we can short-circuit without an AI call.
    """
    msg_lower = message.lower()
    return any(kw in msg_lower for kw in _OUT_OF_SCOPE_KEYWORDS)


def _keyword_in_domain(message: str, domain: str) -> bool | None:
    """
    Quick keyword check against the selected domain's subtopic list.

    Returns:
        True   — at least one domain keyword matched  → likely on-topic
        False  — no match, but domain is not General Science → uncertain
        None   — domain is General Science → skip restriction entirely
    """
    if domain == "General Science":
        return None  # no restriction for the catch-all domain

    cfg = DOMAIN_CONFIG.get(domain, {})
    subtopics = cfg.get("subtopics", [])
    msg_lower = message.lower()
    return any(kw in msg_lower for kw in subtopics)


def _ai_classify_domain(message: str, domain: str) -> bool:
    """
    Ask the model a minimal yes/no question:
      "Does this question belong to the [domain] domain? YES or NO."

    Uses a lightweight param set (max 5 tokens) to keep latency low.
    Returns True if the model says YES, False otherwise.
    Falls back to True on model errors (fail-open) to avoid false rejections.
    """
    classifier_model = ModelInference(
        model_id=GRANITE_MODEL_ID,
        params={
            GenParams.MAX_NEW_TOKENS: 5,
            GenParams.TEMPERATURE:    0.0,
        },
        credentials=Credentials(url=WATSONX_URL, api_key=IBM_API_KEY),
        project_id=WATSONX_PROJECT_ID,
    )
    classify_messages = [
        {
            "role": "system",
            "content": (
                "You are a domain classifier. "
                "Answer ONLY with the single word YES or NO. "
                "Do not add any explanation."
            ),
        },
        {
            "role": "user",
            "content": (
                f'Does the following question belong to the scientific domain '
                f'"{domain}"?\n\n'
                f'Question: {message}\n\n'
                f'Answer YES if it clearly belongs to {domain}. '
                f'Answer NO if it does not.'
            ),
        },
    ]
    try:
        resp = classifier_model.chat(messages=classify_messages)
        answer = resp["choices"][0]["message"]["content"].strip().upper()
        return answer.startswith("YES")
    except Exception:
        return True  # fail-open: let the main model handle edge cases


def _domain_rejection_message(domain: str) -> str:
    """Build the friendly domain-lock rejection message."""
    cfg   = DOMAIN_CONFIG.get(domain, {})
    emoji = cfg.get("emoji", "🔬")
    return (
        f"**{emoji} Domain Lock: {domain}**\n\n"
        f"You are currently in the **{domain}** domain. "
        f"Your question does not appear to be related to {domain}.\n\n"
        f"Please either:\n"
        f"- Ask a **{domain}**-related question, or\n"
        f"- Switch to a different domain using the domain selector above.\n\n"
        f"*Need help with {domain}? Try asking about "
        f"{', '.join(cfg.get('subtopics', [domain])[:4])} and more!*"
    )


def _nonscience_rejection_message() -> str:
    """Standard out-of-scope rejection for clearly non-scientific questions."""
    return (
        "**🔬 Out of Scope**\n\n"
        "I'm **SciMind**, a Scientific Research Assistant. "
        "I can only help with scientific and academic research questions "
        "across domains like Physics, Chemistry, Biology, CS & AI, Space, and more.\n\n"
        "Please ask me a science or research related question!"
    )


def _format_response_with_domain_badge(text: str, domain: str) -> str:
    """
    Prepend a domain badge and append a domain footer to every chat response.
    Example:
        **[Physics]**  <original response>
        ...
        ---
        *Domain: Physics*
    """
    cfg   = DOMAIN_CONFIG.get(domain, {})
    emoji = cfg.get("emoji", "🔬")
    badge  = f"**{emoji} [{domain}]**\n\n"
    footer = f"\n\n---\n*Domain: {domain}*"
    return badge + text + footer

# ===
#  ROUTE: Main UI
# ===
@app.route("/")
def index():
    return render_template("index.html")

# ===
#  ROUTE: General Chat  (domain-aware, strict scope enforcement)
# ===
@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data    = request.get_json(force=True)
        message = data.get("message", "").strip()
        history = data.get("history", [])
        domain  = data.get("domain", "General Science").strip()

        if not message:
            return jsonify({"error": "Message cannot be empty."}), 400

        # ── Normalise domain ─────────────────────────────────────────────
        # Accept any casing / minor mismatch from the frontend
        if domain not in DOMAIN_CONFIG:
            domain = "General Science"

        # ── Store & detect domain switches in session ────────────────────
        prev_domain = session.get("current_domain")
        if prev_domain and prev_domain != domain:
            # Domain switched: clear the stored history so context resets
            session.pop("domain_history", None)
        session["current_domain"] = domain

        # ── LAYER 1: Fast keyword out-of-scope filter ────────────────────
        if _keyword_out_of_scope(message):
            return jsonify({
                "response":  _nonscience_rejection_message(),
                "domain":    domain,
                "blocked":   True,
                "timestamp": datetime.utcnow().isoformat(),
            })

        # ── LAYER 2: Domain keyword check (skipped for General Science) ──
        # keyword_match: True=matched, False=no match, None=general science
        keyword_match = _keyword_in_domain(message, domain)

        if keyword_match is False:
            # No keyword hit — escalate to AI classifier before deciding
            in_domain = _ai_classify_domain(message, domain)
            if not in_domain:
                return jsonify({
                    "response":  _domain_rejection_message(domain),
                    "domain":    domain,
                    "blocked":   True,
                    "timestamp": datetime.utcnow().isoformat(),
                })
        # keyword_match is True or None  → proceed to answer

        # ── Build domain-injected system context ─────────────────────────
        domain_cfg = DOMAIN_CONFIG.get(domain, {})
        emoji      = domain_cfg.get("emoji", "🔬")

        if domain == "General Science":
            domain_instruction = (
                "Answer any scientific or academic research question. "
                "Politely refuse non-scientific questions."
            )
        else:
            domain_instruction = (
                f"You are a strict {domain} domain expert {emoji}. "
                f"ONLY answer questions directly related to {domain}. "
                f"If a question is outside {domain}, politely tell the user to "
                f"switch domains or ask a {domain}-related question."
            )

        system_context = (
            f"{domain_instruction}\n"
            f"Provide a thorough, well-structured, and academically rigorous response. "
            f"Always use Markdown formatting."
        )

        # ── Call the model ────────────────────────────────────────────────
        raw_response = call_model(system_context, message, history)

        # ── Attach domain badge + footer ──────────────────────────────────
        final_response = _format_response_with_domain_badge(raw_response, domain)

        return jsonify({
            "response":  final_response,
            "domain":    domain,
            "blocked":   False,
            "timestamp": datetime.utcnow().isoformat(),
        })

    except Exception as exc:
        return jsonify({
            "error":    str(exc),
            "response": "Something went wrong. Please try again.",
        }), 500
        
# ===
#  ROUTE: Paper Summarization
# ===
@app.route("/api/summarize", methods=["POST"])
def summarize():
    data  = request.get_json(force=True)
    text  = data.get("text", "").strip()
    style = data.get("style", "detailed")   # brief | detailed | technical

    if not text:
        return jsonify({"error": "Paper text/abstract is required."}), 400

    style_guide = {
        "brief":     "Provide a concise 35 sentence summary capturing the core contribution.",
        "detailed":  "Provide a structured summary with: Objective, Methods, Key Findings, Significance, and Limitations.",
        "technical": "Provide a deep technical summary including theoretical framework, experimental design, statistical methods, and quantitative results.",
    }.get(style, "Provide a structured summary.")

    response = call_model(
        "You are summarizing a scientific paper.",
        f"{style_guide}\n\n---\nPAPER TEXT:\n{text}"
    )
    return jsonify({"summary": response, "style": style})

# ===
#  ROUTE: Citation Generator
# ===
@app.route("/api/citation", methods=["POST"])
def citation():
    data   = request.get_json(force=True)
    info   = data.get("info", "").strip()      # raw paper info
    style  = data.get("style", "APA").upper()  # APA | IEEE | NATURE | SCIENCE | MLA

    if not info:
        return jsonify({"error": "Paper information is required."}), 400

    valid_styles = {"APA", "IEEE", "NATURE", "SCIENCE", "MLA"}
    if style not in valid_styles:
        return jsonify({"error": f"Style must be one of: {', '.join(valid_styles)}"}), 400

    response = call_model(
        "You are a precise academic citation formatter.",
        f"""Generate a properly formatted {style} citation from the following paper details.
If any field is missing, use 'n.d.' or '[Unknown]' as appropriate.
Do NOT fabricate DOIs, volume numbers, or page numbers if not provided.
Output ONLY the formatted citation(s), then a brief explanation of the format used.

PAPER DETAILS:
{info}

FORMAT: {style}"""
    )
    return jsonify({"citation": response, "style": style})

# ===
#  ROUTE: Literature Review Builder
# ===
@app.route("/api/literature-review", methods=["POST"])
def literature_review():
    data   = request.get_json(force=True)
    topic  = data.get("topic", "").strip()
    papers = data.get("papers", "").strip()   # list of paper summaries/titles
    scope  = data.get("scope", "comprehensive")

    if not topic:
        return jsonify({"error": "Research topic is required."}), 400

    response = call_model(
        "You are drafting an academic literature review.",
        f"""Write a {scope} literature review on the topic: "{topic}".

{'Use the following papers as sources:\n' + papers if papers else 'Use your knowledge of published research in this area.'}

Structure the review as:
1. **Introduction** - Scope and significance of the topic
2. **Theoretical Background** - Core theories and foundational concepts
3. **Methodology Overview** - Common research approaches used in this field
4. **Key Findings & Trends** - Major discoveries and recent developments
5. **Research Gaps** - Underexplored areas and open questions
6. **Future Directions** - Promising avenues for future research
7. **Key Takeaways** - Bullet-point summary of the most important insights

Use academic language. Label all inferred content as "(inferred)" if not based on provided papers."""
    )
    return jsonify({"review": response, "topic": topic})

# ===
#  ROUTE: Hypothesis Generator
# ===
@app.route("/api/hypothesis", methods=["POST"])
def hypothesis():
    data     = request.get_json(force=True)
    topic    = data.get("topic", "").strip()
    context  = data.get("context", "").strip()
    count    = min(int(data.get("count", 3)), 5)

    if not topic:
        return jsonify({"error": "Research topic is required."}), 400

    response = call_model(
        "You are a scientific hypothesis generator.",
        f"""Generate {count} novel, testable research hypotheses for the topic: "{topic}".
{"Additional context: " + context if context else ""}

For each hypothesis:
- State the hypothesis clearly in H1 format
- Identify the independent and dependent variables
- Suggest a feasible experimental or computational approach to test it
- Note any existing related research (without fabricating citations)
- Rate novelty and feasibility (Low/Medium/High)

Label each as: "Suggested Hypothesis: (unverified - requires empirical validation)" """
    )
    return jsonify({"hypotheses": response, "topic": topic, "count": count})

# ===
#  ROUTE: Research Report Drafter
# ===
@app.route("/api/draft-report", methods=["POST"])
def draft_report():
    data    = request.get_json(force=True)
    topic   = data.get("topic", "").strip()
    section = data.get("section", "full")   # abstract|introduction|methodology|results|conclusion|full
    context = data.get("context", "").strip()

    if not topic:
        return jsonify({"error": "Research topic is required."}), 400

    section_prompts = {
        "abstract":      "Write a concise 150250 word abstract.",
        "introduction":  "Write a 400600 word introduction with background, significance, and research objectives.",
        "methodology":   "Write a detailed methodology section including study design, data collection, and analysis plan.",
        "results":       "Draft a results section framework with suggested data presentation structure.",
        "conclusion":    "Write a conclusion summarizing key findings, implications, and future work.",
        "full":          "Draft a complete research paper outline with all major sections: Abstract, Introduction, Methodology, Results, Discussion, and Conclusion.",
    }
    instruction = section_prompts.get(section, section_prompts["full"])

    response = call_model(
        "You are drafting sections of a scientific research paper.",
        f"""Topic: "{topic}"
{"Context / Notes: " + context if context else ""}

Task: {instruction}

Use academic writing style. Mark any placeholder content with [PLACEHOLDER].
Ensure logical flow and scientific rigor."""
    )
    return jsonify({"draft": response, "topic": topic, "section": section})

# ===
#  ROUTE: Topic Explorer
# ===
@app.route("/api/explore-topic", methods=["POST"])
def explore_topic():
    data   = request.get_json(force=True)
    topic  = data.get("topic", "").strip()
    domain = data.get("domain", "")

    if not topic:
        return jsonify({"error": "Topic is required."}), 400

    response = call_model(
        "You are a scientific topic exploration guide.",
        f"""Provide a comprehensive overview of the scientific topic: "{topic}"
{"Domain: " + domain if domain else ""}

Structure your response as:
## Topic Overview
Brief definition and significance.

## Key Concepts & Terminology
Top 8-10 fundamental concepts.

## Foundational Theories & Models
Core theories underpinning this topic.

## Current Research Frontiers
Most active research areas (last 5 years).

## Common Research Methods
Experimental, computational, or observational approaches.

## Seminal Papers & Resources
List 5-7 landmark papers or books (clearly label as suggestions, not fabricated citations).

## Interdisciplinary Connections
Related fields and cross-domain applications.

## Open Questions
3-5 major unresolved questions in this field."""
    )
    return jsonify({"exploration": response, "topic": topic})

# ===
#  ROUTE: Concept Explainer
# ===
@app.route("/api/explain", methods=["POST"])
def explain_concept():
    data    = request.get_json(force=True)
    concept = data.get("concept", "").strip()
    level   = data.get("level", "intermediate")  # beginner | intermediate | expert

    if not concept:
        return jsonify({"error": "Concept is required."}), 400

    level_map = {
        "beginner":     "Explain as if to a curious high school student with no prior background.",
        "intermediate": "Explain as if to an undergraduate science student.",
        "expert":       "Explain with full technical depth for a PhD-level researcher.",
    }
    instruction = level_map.get(level, level_map["intermediate"])

    response = call_model(
        "You are a scientific concept educator.",
        f"""Explain the scientific concept: "{concept}"
Level: {instruction}

Include:
- Core definition
- Intuitive analogy (where applicable)
- Mathematical or chemical notation (if relevant, at this level)
- Real-world examples or applications
- Common misconceptions to avoid"""
    )
    return jsonify({"explanation": response, "concept": concept, "level": level})

# ===
#  ROUTE: Theory Comparator
# ===
@app.route("/api/compare-theories", methods=["POST"])
def compare_theories():
    data    = request.get_json(force=True)
    theory1 = data.get("theory1", "").strip()
    theory2 = data.get("theory2", "").strip()
    domain  = data.get("domain", "")

    if not theory1 or not theory2:
        return jsonify({"error": "Both theory1 and theory2 are required."}), 400

    response = call_model(
        "You are a scientific theory analyst.",
        f"""Compare and contrast the following scientific theories or models:
Theory A: "{theory1}"
Theory B: "{theory2}"
{"Domain: " + domain if domain else ""}

Provide:
## Overview of Each Theory
## Similarities
## Key Differences
## Supporting Evidence (for each)
## Limitations & Criticisms (for each)
## Current Scientific Consensus
## Practical Applications
## Verdict: Which is better supported by evidence, and why?"""
    )
    return jsonify({"comparison": response, "theory1": theory1, "theory2": theory2})

# ===
#  ROUTE: Health check
# ===
@app.route("/api/health")
def health():
    return jsonify({
        "status":    "ok",
        "agent":     "SciMind - Scientific Research Agent",
        "model":     GRANITE_MODEL_ID,
        "timestamp": datetime.utcnow().isoformat(),
    })

# === Entry point ===
if __name__ == "__main__":
    port  = int(os.getenv("FLASK_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    print(f"""
===
===   SciMind - Scientific Research Agent        ===
===   IBM Watsonx.ai + Granite                   ===
===   Running on http://localhost:{port}          ===
===
    """)
    app.run(host="0.0.0.0", port=port, debug=debug)
