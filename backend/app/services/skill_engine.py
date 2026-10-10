from typing import List, Dict, Any

class SkillEngine:
    """
    Skill Intelligence, Hidden Skills Discovery, and Gap Analysis Engine.
    Keeps inferred skills strictly separated from verified qualifications.
    """

    # Domain Knowledge Graph: Base Skill -> Inferred / Related Skills
    SKILL_RELATIONSHIPS = {
        "dbms": [
            {"name": "SQL Tuning", "confidence": 0.92, "category": "Database Engineering"},
            {"name": "Schema Design", "confidence": 0.88, "category": "Database Engineering"},
            {"name": "Transaction Isolation", "confidence": 0.84, "category": "Core Theory"},
            {"name": "NoSQL / MongoDB", "confidence": 0.75, "category": "Distributed Systems"}
        ],
        "python": [
            {"name": "Pandas / NumPy", "confidence": 0.90, "category": "Data Science"},
            {"name": "FastAPI / Backend", "confidence": 0.86, "category": "Web Dev"},
            {"name": "Async Programming", "confidence": 0.82, "category": "Systems"},
            {"name": "Pytest", "confidence": 0.85, "category": "QA & Testing"}
        ],
        "react": [
            {"name": "TypeScript", "confidence": 0.94, "category": "Frontend"},
            {"name": "Tailwind CSS", "confidence": 0.89, "category": "UI/UX"},
            {"name": "State Management", "confidence": 0.87, "category": "Frontend Architecture"},
            {"name": "Responsive Design", "confidence": 0.91, "category": "UI/UX"}
        ],
        "machine learning": [
            {"name": "Deep Learning", "confidence": 0.85, "category": "AI"},
            {"name": "Scikit-Learn", "confidence": 0.95, "category": "AI"},
            {"name": "Model Evaluation", "confidence": 0.90, "category": "Data Science"},
            {"name": "Feature Engineering", "confidence": 0.88, "category": "Data Science"}
        ],
        "icu": [
            {"name": "Mechanical Ventilation", "confidence": 0.92, "category": "Critical Care"},
            {"name": "Hemodynamic Monitoring", "confidence": 0.90, "category": "Critical Care"},
            {"name": "Emergency Triage", "confidence": 0.88, "category": "Emergency Med"},
            {"name": "ACLS / CPR", "confidence": 0.96, "category": "Emergency Med"}
        ],
        "emergency": [
            {"name": "Trauma Resuscitation", "confidence": 0.93, "category": "Emergency Med"},
            {"name": "Rapid Triage", "confidence": 0.91, "category": "Emergency Med"},
            {"name": "Airway Management", "confidence": 0.87, "category": "Critical Care"}
        ],
        "assembly": [
            {"name": "Quality Control (QC)", "confidence": 0.89, "category": "Manufacturing"},
            {"name": "Six Sigma", "confidence": 0.78, "category": "Manufacturing"},
            {"name": "Precision Tooling", "confidence": 0.86, "category": "Operations"}
        ]
    }

    @classmethod
    def infer_hidden_skills(cls, direct_skills: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Discovers inferred skills based on direct verified skills.
        Inferred skills have confidence scores and reason tags.
        """
        existing_names = {s.get("name", "").lower() for s in direct_skills}
        inferred = []

        for skill in direct_skills:
            sk_name = skill.get("name", "").lower()
            if sk_name in cls.SKILL_RELATIONSHIPS:
                for rel in cls.SKILL_RELATIONSHIPS[sk_name]:
                    if rel["name"].lower() not in existing_names:
                        inferred.append({
                            "name": rel["name"],
                            "confidence": rel["confidence"],
                            "category": rel["category"],
                            "source_skill": skill.get("name"),
                            "reason": f"Strongly correlated with verified skill '{skill.get('name')}'"
                        })
                        existing_names.add(rel["name"].lower())

        return inferred

    @classmethod
    def analyze_skill_gaps(
        cls,
        required_slots: List[Dict[str, Any]],
        available_people: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Compares schedule slot requirements against active staff inventory.
        Identifies shortages, critical single points of failure, and training recommendations.
        """
        required_skill_counts = {}
        for slot in required_slots:
            for sk in (slot.get("required_skills") or []):
                required_skill_counts[sk] = required_skill_counts.get(sk, 0) + 1

        available_skill_counts = {}
        skill_holders = {}
        for p in available_people:
            p_skills = [s.get("name", "") for s in (p.get("skills") or [])]
            for sk in p_skills:
                available_skill_counts[sk] = available_skill_counts.get(sk, 0) + 1
                skill_holders.setdefault(sk, []).append(p.get("name"))

        gaps = []
        recommendations = []

        for req_sk, req_cnt in required_skill_counts.items():
            avail_cnt = available_skill_counts.get(req_sk, 0)
            status = "sufficient"
            if avail_cnt == 0:
                status = "critical_shortage"
                gaps.append({
                    "skill": req_sk,
                    "required_demand": req_cnt,
                    "available_supply": 0,
                    "status": "critical",
                    "holders": []
                })
                recommendations.append(
                    f"Immediate training or external hiring required for '{req_sk}' (0 staff qualified, {req_cnt} slots needed)."
                )
            elif avail_cnt == 1 and req_cnt > 2:
                status = "single_point_of_failure"
                gaps.append({
                    "skill": req_sk,
                    "required_demand": req_cnt,
                    "available_supply": 1,
                    "status": "risk",
                    "holders": skill_holders.get(req_sk, [])
                })
                recommendations.append(
                    f"Cross-train 2 additional team members on '{req_sk}' to eliminate single-point-of-failure risk."
                )

        return {
            "total_skills_tracked": len(set(list(required_skill_counts.keys()) + list(available_skill_counts.keys()))),
            "demand_matrix": required_skill_counts,
            "supply_matrix": available_skill_counts,
            "skill_gaps": gaps,
            "training_recommendations": recommendations or [
                "Overall skill distribution meets current operational demand comfortably.",
                "Encourage senior staff to mentor junior team members on high-demand skills."
            ]
        }
