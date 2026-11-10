"""Bayesian Knowledge Tracing.

Four parameters per concept: P(L0) prior mastery, T learn rate, S slip, G guess.
After each answer the belief is updated with Bayes' rule, then the learning transition
is applied. The same formula runs in the frontend for instant feedback.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class BKT:
    p_init: float = 0.2
    p_learn: float = 0.15
    p_slip: float = 0.1
    p_guess: float = 0.25

    def update(self, p: float, correct: bool) -> float:
        s, g = self.p_slip, self.p_guess
        if correct:
            posterior = p * (1 - s) / (p * (1 - s) + (1 - p) * g)
        else:
            posterior = p * s / (p * s + (1 - p) * (1 - g))
        return min(0.99, posterior + (1 - posterior) * self.p_learn)

    def p_correct(self, p: float) -> float:
        """Predicted chance of answering correctly; used to evaluate the model."""
        return p * (1 - self.p_slip) + (1 - p) * self.p_guess


DEFAULT = BKT()
# Numerical-answer questions are much harder to guess.
NAT = BKT(p_guess=0.05)


def params_for(qtype: str, fitted: "BKT | None" = None) -> BKT:
    if fitted is not None:
        return fitted
    return NAT if qtype == "NAT" else DEFAULT
