from pymeasure.instruments.keithley import Keithley2400
# Assume SMUInterface is in a file named instrument_interfaces.py
from SMU import SMUInterface

class Keithley2400Adapter(SMUInterface):
    """
    An adapter for the Keithley 2400 SMU that implements the SMUInterface.
    """
    
    VOLTAGE_RANGES = [.2, 2, 20]
    CURRENT_RANGES = [.000001, .00001, .0001, .001, .01, .1, 1]
    
    def __init__(self, visa_address: str):
        self.instrument = Keithley2400(visa_address)
        self._source_type = None
        
    def _get_nearest_larger_range(self, value: float, ranges: list[float]):
        positive_ranges = [r for r in ranges if r >= abs(value)]
        if not positive_ranges:
            raise ValueError(f"Value {value} is too large for the available ranges.")
        return min(positive_ranges)
        

    def configure_voltage_source(self, voltage_limit: float, compliance_current: float, is_4_wire: bool):
        """Configures the SMU to source voltage and measure current."""
        self.instrument.apply_voltage()
        self.instrument.measure_current()
        self.instrument.source_voltage_range = self._get_nearest_larger_range(voltage_limit, self.VOLTAGE_RANGES)
        self.instrument.compliance_current = compliance_current
        self.instrument.wires = 4 if is_4_wire else 2
        self._source_type = "VOLT"
        
    def configure_current_source(self, current_limit: float, compliance_voltage: float, is_4_wire: bool):
        """Configures the SMU to source current and measure voltage."""
        self.instrument.apply_current()
        self.instrument.measure_voltage()
        self.instrument.source_current_range = self._get_nearest_larger_range(current_limit, self.CURRENT_RANGES)
        self.instrument.compliance_voltage = compliance_voltage
        self.instrument.wires = 4 if is_4_wire else 2
        self._source_type = "CURR"

    @property
    def source_value(self):
        """Gets the current source value (V or A)."""
        if self._source_type == "VOLT":
            return self.instrument.source_voltage
        elif self._source_type == "CURR":
            return self.instrument.source_current
        raise RuntimeError("Source has not been configured yet.")

    @source_value.setter
    def source_value(self, value: float):
        """Sets the source value (V or A)."""
        if self._source_type == "VOLT":
            self.instrument.source_voltage = value
        elif self._source_type == "CURR":
            self.instrument.source_current = value
        else:
            raise RuntimeError("Source has not been configured yet.")
    
    @property
    def measured_value(self) -> float:
        """Gets the measured value (V or A)."""
        if self._source_type == "VOLT":
            return self.instrument.current
        elif self._source_type == "CURR":
            return self.instrument.voltage
        raise RuntimeError("Source has not been configured yet.")

    def enable_source(self):
        """Turns the source output on."""
        self.instrument.enable_source()

    def shutdown(self):
        """Turns the source output off and returns to a safe state."""
        self.instrument.shutdown()

    def close(self):
        """Closes the communication connection to the instrument."""
        self.instrument.adapter.close()
    
    @property
    def supports_4_wire(self) -> bool:
        """Returns True as the Keithley 2400 supports 4-wire measurement."""
        return True