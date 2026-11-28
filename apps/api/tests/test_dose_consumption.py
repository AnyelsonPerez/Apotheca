"""Tests for the daily-dose virtual consumption calculation.

These cover the new depletion logic introduced in feat/daily-dose-treatment:
the discount is computed on read and never mutates the stored quantity.
"""
from datetime import date, timedelta

from apotheca_api.models import compute_dose_consumption


class TestComputeDoseConsumption:
    today = date(2026, 11, 27)

    def test_no_dose_returns_full_quantity(self):
        eff, days_left, consuming = compute_dose_consumption(
            quantity=20, daily_dose=None, treatment_days=5, dose_start_date=date(2026, 11, 20), now=self.today
        )
        assert eff == 20.0
        assert days_left is None
        assert consuming is False

    def test_zero_dose_returns_full_quantity(self):
        eff, days_left, consuming = compute_dose_consumption(
            quantity=20, daily_dose=0, treatment_days=5, dose_start_date=date(2026, 11, 20), now=self.today
        )
        assert eff == 20.0
        assert days_left is None
        assert consuming is False

    def test_no_start_date_returns_full_quantity(self):
        eff, days_left, consuming = compute_dose_consumption(
            quantity=20, daily_dose=3, treatment_days=5, dose_start_date=None, now=self.today
        )
        assert eff == 20.0
        assert days_left is None
        assert consuming is False

    def test_future_start_date_returns_full_quantity(self):
        future = self.today + timedelta(days=3)
        eff, days_left, consuming = compute_dose_consumption(
            quantity=20, daily_dose=3, treatment_days=5, dose_start_date=future, now=self.today
        )
        assert eff == 20.0
        assert days_left is None
        assert consuming is False

    def test_active_treatment_discounts_progressively(self):
        # Started 3 days ago, 3/day for 5 days: 3*3=9 consumed
        eff, days_left, consuming = compute_dose_consumption(
            quantity=20, daily_dose=3, treatment_days=5, dose_start_date=date(2026, 11, 24), now=self.today
        )
        assert eff == 11.0  # 20 - 9
        assert days_left is not None
        assert days_left == round(11.0 / 3, 10) or abs(days_left - 11.0 / 3) < 0.01
        assert consuming is True

    def test_treatment_finished_stops_discounting(self):
        # Started 6 days ago, 3/day for 5 days: 3*5=15 consumed, then stops
        eff, days_left, consuming = compute_dose_consumption(
            quantity=20, daily_dose=3, treatment_days=5, dose_start_date=date(2026, 11, 21), now=self.today
        )
        assert eff == 5.0  # 20 - 15
        assert days_left is None  # treatment finished with stock remaining
        assert consuming is False

    def test_depleted_during_treatment_still_alerts(self):
        # Stock reaches zero exactly when treatment ends: should still report days_left=0
        eff, days_left, consuming = compute_dose_consumption(
            quantity=15, daily_dose=3, treatment_days=5, dose_start_date=date(2026, 11, 22), now=self.today
        )
        assert eff == 0.0  # 15 - (3 * 5) = 0
        assert days_left == 0.0  # depleted → 0, not None
        assert consuming is False  # treatment finished

    def test_quantity_never_negative(self):
        # Huge dose over many days, but treatment_days caps consumption
        eff, days_left, consuming = compute_dose_consumption(
            quantity=5, daily_dose=10, treatment_days=2, dose_start_date=date(2026, 11, 20), now=self.today
        )
        assert eff == 0.0  # max(0, 5 - 20) clamped
        assert days_left == 0.0  # depleted → 0, not None
        assert consuming is False  # treatment finished

    def test_example_from_spec(self):
        # 20 comprimidos, 3 al día durante 5 días, started 5 days ago
        # 5 days elapsed = treatment_days, so 3*5=15 consumed
        eff, days_left, consuming = compute_dose_consumption(
            quantity=20, daily_dose=3, treatment_days=5, dose_start_date=date(2026, 11, 22), now=self.today
        )
        assert eff == 5.0  # 20 - 15
        assert days_left is None  # treatment finished with stock remaining
        assert consuming is False  # treatment finished after 5 days

    def test_no_treatment_days_consume_indefinitely(self):
        # No treatment_days: consumes indefinitely
        # 7 days elapsed, 2/day = 14 consumed
        eff, days_left, consuming = compute_dose_consumption(
            quantity=30, daily_dose=2, treatment_days=None, dose_start_date=date(2026, 11, 20), now=self.today
        )
        assert eff == 16.0  # 30 - 14
        assert days_left == 8.0  # 16 / 2
        assert consuming is True

    def test_decimal_quantities_and_dose(self):
        # 10.5 units, 1.5/day for 4 days, started 2 days ago
        eff, days_left, consuming = compute_dose_consumption(
            quantity=10.5, daily_dose=1.5, treatment_days=4, dose_start_date=date(2026, 11, 25), now=self.today
        )
        assert eff == 7.5  # 10.5 - (1.5 * 2)
        assert days_left == 5.0  # 7.5 / 1.5
        assert consuming is True
