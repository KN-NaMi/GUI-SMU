from abc import ABC, abstractmethod

class SMUInterface(ABC):
    """
    An abstract interface for a generic Source-Measure Unit.
    """
    @abstractmethod
    def configure_voltage_source(self, voltage_limit: float, compliance_current: float, is_4_wire: bool):
        """Configures the SMU to source voltage and measure current,
           optimizing settings for the given voltage limit (maximum absolute voltage)."""
        pass

    @abstractmethod
    def configure_current_source(self, current_limit: float, compliance_voltage: float, is_4_wire: bool):
        """Configurges the SMU to source current and measure voltage,
           optimizing settings for the given current limit (maximum absolute current)."""
        pass

    @property
    @abstractmethod
    def source_value(self):
        """A generic property to get the current source value."""
        pass

    @source_value.setter
    @abstractmethod
    def source_value(self, value: float):
        """A generic property to set the source value (either V or A)."""
        pass
    
    @property
    @abstractmethod
    def measured_value(self):
        """A generic property to get the measured value (either V or A)."""
        pass

    @abstractmethod
    def enable_source(self):
        """Turns the source output on."""
        pass

    @abstractmethod
    def shutdown(self):
        """Turns the source output off and returns to a safe state."""
        pass
    
    @abstractmethod
    def close(self):
        """Closes the communication connection to the instrument."""
        pass

    @property
    def supports_4_wire(self) -> bool:
        """Returns True if the instrument supports 4-wire measurement."""
        return False