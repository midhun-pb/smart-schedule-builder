import re
import datetime
from typing import List, Dict, Any, Tuple
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

class SearchEngine:
    """
    Intelligent IR/NLP Search Engine for Smart Schedule Builder.
    Parses natural language requirements, extracts skills, dates, times,
    qualifications, and rank candidates using TF-IDF text similarity
    and multi-attribute constraint evaluation.
    """

    DAYS_MAP = {
        "monday": 0, "mon": 0,
        "tuesday": 1, "tue": 1,
        "wednesday": 2, "wed": 2,
        "thursday": 3, "thu": 3,
        "friday": 4, "fri": 4,
        "saturday": 5, "sat": 5,
        "sunday": 6, "sun": 6
    }

    TIME_PATTERNS = [
        (r'(\d{1,2})\s*(?:am|a\.m\.)', lambda m: f"{int(m.group(1)):02d}:00"),
        (r'(\d{1,2})\s*(?:pm|p\.m\.)', lambda m: f"{(int(m.group(1)) % 12 + 12):02d}:00"),
        (r'(\d{1,2}):(\d{2})', lambda m: f"{int(m.group(1)):02d}:{m.group(2)}"),
        (r'\bmorning\b', lambda _: "09:00"),
        (r'\bafternoon\b', lambda _: "14:00"),
        (r'\bevening\b', lambda _: "18:00"),
        (r'\bnight\b', lambda _: "22:00"),
    ]

    COMMON_SKILLS = [
        "dbms", "database", "python", "java", "c++", "data structures", "algorithms",
        "react", "typescript", "javascript", "machine learning", "ai", "cloud",
        "aws", "docker", "kubernetes", "sql", "operating systems", "computer networks",
        "icu", "cardiology", "pediatrics", "emergency", "surgery", "triage",
        "forklift", "assembly", "quality control", "maintenance", "electrical",
        "pilot", "boeing 737", "airbus a320", "navigation", "flight safety",
        "front desk", "housekeeping", "concierge", "culinary", "patrol", "firefighting"
    ]

    QUALIFICATIONS = [
        "ph.d", "phd", "m.tech", "mtech", "b.tech", "btech", "m.sc", "msc",
        "md", "mbbs", "rn", "bsn", "certified", "pmp", "aws certified"
    ]

    def parse_query(self, query: str) -> Dict[str, Any]:
        """
        Extracts structured requirements from natural language.
        """
        q_lower = query.lower()
        extracted = {
            "raw_query": query,
            "skills": [],
            "day_of_week": None,
            "time": None,
            "qualifications": [],
            "min_experience": 0.0,
            "metadata": {},
            "requested_count": 1
        }

        # 1. Number of people requested (e.g. "two experienced python developers")
        num_match = re.search(r'\b(one|two|three|four|five|six|1|2|3|4|5)\b', q_lower)
        if num_match:
            word_to_num = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6}
            val = num_match.group(1)
            extracted["requested_count"] = word_to_num.get(val, int(val) if val.isdigit() else 1)

        # 2. Extract day of week or relative date
        for day_name, day_idx in self.DAYS_MAP.items():
            if re.search(rf'\b{day_name}\b', q_lower):
                extracted["day_of_week"] = day_idx
                break
        if "tomorrow" in q_lower:
            extracted["metadata"]["relative_day"] = "tomorrow"
        elif "today" in q_lower:
            extracted["metadata"]["relative_day"] = "today"

        # 3. Extract time
        for pattern, extractor in self.TIME_PATTERNS:
            m = re.search(pattern, q_lower)
            if m:
                extracted["time"] = extractor(m)
                break

        # 4. Extract skills
        for sk in self.COMMON_SKILLS:
            if re.search(rf'\b{re.escape(sk)}\b', q_lower):
                extracted["skills"].append(sk.upper() if len(sk) <= 4 else sk.title())

        # 5. Extract qualifications
        for qual in self.QUALIFICATIONS:
            if qual in q_lower:
                extracted["qualifications"].append(qual.upper())

        # 6. Extract experience
        exp_match = re.search(r'(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?exp', q_lower)
        if exp_match:
            extracted["min_experience"] = float(exp_match.group(1))
        elif "experienced" in q_lower or "senior" in q_lower:
            extracted["min_experience"] = 3.0

        # 7. Extract semester / class / department (e.g., "S5 CSE")
        sem_match = re.search(r'\b(s[1-8]|sem\s*[1-8]|semester\s*[1-8])\b', q_lower)
        if sem_match:
            extracted["metadata"]["semester"] = sem_match.group(1).upper()
        
        dept_match = re.search(r'\b(cse|ece|mech|civil|eee|it|cardiology|radiology|emergency)\b', q_lower)
        if dept_match:
            extracted["metadata"]["department"] = dept_match.group(1).upper()

        return extracted

    def rank_candidates(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        leave_records: List[Dict[str, Any]] = None,
        slot_context: Dict[str, Any] = None,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Ranks real candidates using TF-IDF text similarity and multi-factor matching.
        """
        if not candidates:
            return []

        parsed = self.parse_query(query)
        leave_records = leave_records or []

        # Build textual representation for each candidate
        corpus = []
        for c in candidates:
            c_skills = " ".join([s.get("name", "") for s in c.get("skills", [])])
            c_inf_skills = " ".join([s.get("name", "") for s in c.get("inferred_skills", [])])
            c_quals = " ".join(c.get("qualifications", []))
            c_dept = str(c.get("department_id", ""))
            c_role = c.get("role_title", "")
            c_text = f"{c.get('name', '')} {c_role} {c_dept} {c_skills} {c_inf_skills} {c_quals}"
            corpus.append(c_text)

        # Fit TF-IDF on corpus + query
        corpus_with_query = corpus + [query]
        vectorizer = TfidfVectorizer(stop_words='english')
        try:
            tfidf_matrix = vectorizer.fit_transform(corpus_with_query)
            query_vec = tfidf_matrix[-1]
            doc_vecs = tfidf_matrix[:-1]
            text_sims = cosine_similarity(query_vec, doc_vecs)[0]
        except Exception:
            text_sims = [0.5] * len(candidates)

        ranked_results = []
        target_day = parsed.get("day_of_week")
        target_time = parsed.get("time")

        for idx, candidate in enumerate(candidates):
            c_id = candidate.get("id")
            score_components = {
                "skill_match": 0.0,
                "qualification_match": 0.0,
                "availability_match": 100.0,
                "experience_match": 100.0,
                "text_similarity": float(text_sims[idx]) * 100.0
            }
            explanations = []
            missing_requirements = []
            rejection_reasons = []

            # 1. Skill evaluation
            c_skill_names = {s.get("name", "").lower(): s for s in candidate.get("skills", [])}
            c_inf_skill_names = {s.get("name", "").lower(): s for s in candidate.get("inferred_skills", [])}
            
            matched_skills_count = 0
            if parsed["skills"]:
                for req_sk in parsed["skills"]:
                    req_lower = req_sk.lower()
                    if req_lower in c_skill_names:
                        matched_skills_count += 1
                        lvl = c_skill_names[req_lower].get("level", "Intermediate")
                        explanations.append(f"Direct verified skill match for {req_sk} ({lvl})")
                    elif req_lower in c_inf_skill_names:
                        matched_skills_count += 0.8
                        conf = int(c_inf_skill_names[req_lower].get("confidence", 0.8) * 100)
                        explanations.append(f"Inferred complementary skill match for {req_sk} ({conf}% confidence)")
                    else:
                        missing_requirements.append(f"Missing skill: {req_sk}")

                score_components["skill_match"] = (matched_skills_count / len(parsed["skills"])) * 100.0
            else:
                score_components["skill_match"] = 80.0

            # 2. Qualifications evaluation
            c_quals = [q.lower() for q in candidate.get("qualifications", [])]
            if parsed["qualifications"]:
                matched_q = sum(1 for q in parsed["qualifications"] if any(q.lower() in cq for cq in c_quals))
                score_components["qualification_match"] = (matched_q / len(parsed["qualifications"])) * 100.0
                if matched_q > 0:
                    explanations.append(f"Holds required qualification(s)")
                else:
                    missing_requirements.append(f"Missing required qualification(s)")
            else:
                score_components["qualification_match"] = 90.0

            # 3. Availability check
            is_on_leave = False
            for l in leave_records:
                if l.get("person_id") == c_id:
                    is_on_leave = True
                    break

            if is_on_leave:
                score_components["availability_match"] = 0.0
                rejection_reasons.append("Currently marked as on leave or unavailable")
            else:
                explanations.append("Available without leave conflicts")

            # 4. Overall Weighted Score
            overall_score = (
                score_components["skill_match"] * 0.40 +
                score_components["availability_match"] * 0.25 +
                score_components["qualification_match"] * 0.15 +
                score_components["text_similarity"] * 0.20
            )

            if is_on_leave:
                overall_score = min(overall_score, 25.0)

            ranked_results.append({
                "person": candidate,
                "match_percentage": round(min(100.0, max(10.0, overall_score)), 1),
                "score_components": score_components,
                "explanations": explanations,
                "missing_requirements": missing_requirements,
                "rejection_reasons": rejection_reasons,
                "is_recommended": overall_score >= 70.0 and not is_on_leave
            })

        # Sort descending by match percentage
        ranked_results.sort(key=lambda r: r["match_percentage"], reverse=True)
        return ranked_results[:top_k]
