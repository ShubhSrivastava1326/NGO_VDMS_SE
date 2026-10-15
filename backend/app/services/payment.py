"""Payment-processing module (SI-2).

Release 1.0 uses SimulatedGateway (CO-4: no real money moves). A real gateway (Razorpay, Stripe)
later only needs to implement PaymentGateway and be returned from get_gateway(); the Donation
Processing requirements and API stay unchanged (SI-2.2).
"""
import random
import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from app.core.config import settings
from app.models.enums import PaymentMethod


@dataclass
class PaymentResult:
    success: bool
    reference: str
    message: str | None = None


class PaymentGateway(Protocol):
    def authorize_and_capture(
        self, amount: Decimal, method: PaymentMethod, forced_outcome: str | None = None
    ) -> PaymentResult: ...


class SimulatedGateway:
    def authorize_and_capture(
        self, amount: Decimal, method: PaymentMethod, forced_outcome: str | None = None
    ) -> PaymentResult:
        if forced_outcome and settings.payment_allow_forced_outcome:
            success = forced_outcome == "success"
        else:
            success = random.random() >= settings.payment_failure_rate
        reference = f"SIM-{uuid.uuid4().hex[:12].upper()}"
        if success:
            return PaymentResult(True, reference)
        return PaymentResult(False, reference, f"Payment via {method.value} was declined (simulated)")


def get_gateway() -> PaymentGateway:
    return SimulatedGateway()
