from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class TransactionLine(StrictModel):
    item_id: str
    quantity: int = Field(gt=0)
    unit: str


class CheckoutRequest(StrictModel):
    client_transaction_id: str = Field(min_length=8, max_length=128)
    store_id: str
    user_name: str | None = Field(default=None, max_length=120)
    items: list[TransactionLine] = Field(min_length=1, max_length=100)
    notes: str | None = Field(default=None, max_length=1000)


class ReturnLine(TransactionLine):
    detection_id: str
    condition: Literal["good", "damaged", "unknown"] = "good"


class ReturnRequest(StrictModel):
    client_transaction_id: str = Field(min_length=8, max_length=128)
    scan_session_id: str
    store_id: str
    user_name: str | None = Field(default=None, max_length=120)
    items: list[ReturnLine] = Field(min_length=1, max_length=100)


class ScanRequest(StrictModel):
    mode: Literal["bulk_return", "checkout"] = "bulk_return"
    store_id: str = "store-1"
    client_scan_id: str | None = Field(default=None, max_length=128)
    fixture: Literal["mixed", "all_ready", "unknown", "empty", "unavailable"] = "mixed"


class ReviewRequest(StrictModel):
    action: Literal["confirm", "choose_another", "scan_again", "reject"]
    selected_item_id: str | None = None
    quantity: int | None = Field(default=None, gt=0)
    reason: str | None = Field(default=None, max_length=500)
    reviewed_by: str | None = Field(default=None, max_length=120)


class SyncOperation(StrictModel):
    client_transaction_id: str
    type: Literal["checkout", "return"]
    created_offline_at: str
    payload: dict


class SyncRequest(StrictModel):
    device_id: str = Field(min_length=1, max_length=128)
    operations: list[SyncOperation] = Field(max_length=100)
