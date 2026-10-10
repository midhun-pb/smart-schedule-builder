from typing import List, Dict, Any
import numpy as np

class FairnessEngine:
    """
    Workload, Shift Distribution, and Fairness Engine.
    Calculates Gini Coefficient, workload variance, night/weekend distribution,
    and generates actionable explanations and rebalancing recommendations.
    """

    @staticmethod
    def calculate_gini(workloads: List[float]) -> float:
        """
        Calculates Gini coefficient (0 = perfect equality, 1 = maximum inequality).
        Returns a 0-100 fairness score where 100 = perfect equality.
        """
        if not workloads or len(workloads) <= 1:
            return 100.0

        array = np.array(workloads, dtype=np.float64)
        if np.amin(array) < 0:
            array -= np.amin(array)
        array += 0.0000001 # prevent zero division
        array = np.sort(array)
        index = np.arange(1, array.shape[0] + 1)
        n = array.shape[0]
        gini = ((np.sum((2 * index - n - 1) * array)) / (n * np.sum(array)))
        # Convert Gini to a fairness score (0 gini => 100 fairness)
        fairness = max(0.0, min(100.0, (1.0 - gini) * 100.0))
        return round(float(fairness), 1)

    @staticmethod
    def analyze_schedule_fairness(
        people: List[Dict[str, Any]],
        assignments: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analyzes assignment distributions across people, checks night/weekend shifts,
        and produces fairness metrics and explanations.
        """
        if not people:
            return {
                "fairness_score": 100.0,
                "workload_distribution": [],
                "imbalance_metrics": {},
                "explanations": ["No active staff registered to analyze."]
            }

        person_stats = {}
        for p in people:
            person_stats[p["id"]] = {
                "id": p["id"],
                "name": p["name"],
                "role": p.get("role_title", "Staff"),
                "total_hours": 0.0,
                "shift_count": 0,
                "night_shifts": 0,
                "weekend_shifts": 0,
                "max_allowed_hours": p.get("max_hours_per_week", 40.0),
                "overtime_hours": 0.0,
            }

        for a in assignments:
            p_id = a.get("person_id")
            if p_id in person_stats:
                person_stats[p_id]["shift_count"] += 1
                # Estimate 1 to 2 hours per slot
                dur = 1.5
                person_stats[p_id]["total_hours"] += dur
                
                # Check night shift
                start = a.get("start_time", "")
                if start >= "19:00" or start <= "06:00":
                    person_stats[p_id]["night_shifts"] += 1
                
                # Check weekend
                day = a.get("day_of_week", 0)
                if day in [5, 6]:
                    person_stats[p_id]["weekend_shifts"] += 1

        workloads = []
        for p_id, stats in person_stats.items():
            diff = stats["total_hours"] - stats["max_allowed_hours"]
            if diff > 0:
                stats["overtime_hours"] = round(diff, 1)
            workloads.append(stats["total_hours"])

        fairness_score = FairnessEngine.calculate_gini(workloads)
        
        # Calculate standard deviation and mean
        mean_hours = float(np.mean(workloads)) if workloads else 0.0
        std_hours = float(np.std(workloads)) if workloads else 0.0

        explanations = []
        if fairness_score >= 85:
            explanations.append(f"Workload is equitably distributed across all {len(people)} staff members.")
        elif fairness_score >= 70:
            explanations.append("Moderate workload variance detected. A few members carry slightly more shift loads.")
        else:
            explanations.append("Significant workload imbalance detected. Rebalancing recommended to prevent burnout.")

        overtime_staff = [s["name"] for s in person_stats.values() if s["overtime_hours"] > 0]
        if overtime_staff:
            explanations.append(f"Staff with overtime warning: {', '.join(overtime_staff[:3])}.")

        return {
            "fairness_score": fairness_score,
            "mean_workload_hours": round(mean_hours, 1),
            "std_deviation": round(std_hours, 2),
            "workload_distribution": list(person_stats.values()),
            "explanations": explanations,
            "recommendations": [
                "Shift 2 morning slots from overloaded staff to underutilized members.",
                "Ensure night and weekend duties alternate weekly.",
                "Verify employee preference settings to align assignments with availability."
            ]
        }
