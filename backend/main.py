from fastapi import FastAPI, Response, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ValidationError
from pydantic_core import from_json
from typing import Optional
from time import sleep

import random, tempfile, threading, time, asyncio
import numpy as np

from pymeasure.log import console_log
from pymeasure.experiment import Procedure, IntegerParameter, Parameter, FloatParameter, ListParameter
from pymeasure.experiment import Results, Worker
from Keithley2400_adapter import Keithley2400Adapter

import logging
from logging.handlers import QueueHandler
log = logging.getLogger('')
log.addHandler(logging.NullHandler())
log.setLevel(logging.DEBUG)

#data classes

class DataCommand(BaseModel):
    command: Optional[str] = None
    port: Optional[str] = None
    timeout: Optional[int] = 20 #minutes
    delay: Optional[int] = 10
    isBothWays: Optional[bool] = False
    is4Wire: Optional[bool] = False
    isVoltSrc: Optional[bool] = True
    voltLimit: Optional[float] = None
    currLimit: Optional[float] = None
    iMax: Optional[float] = None
    iMin: Optional[float] = None
    uMax: Optional[float] = None
    uMin: Optional[float] = None
    iterations: Optional[int] = None
    
class TestDataCommand(BaseModel):
    command: Optional[str] = None
    port: Optional[str] = None
    timeout: Optional[int] = 20 #minutes
    delay: Optional[int] = 0.1
    isBothWays: Optional[bool] = False
    is4Wire: Optional[bool] = False
    isVoltSrc: Optional[bool] = True
    voltLimit: Optional[float] = None
    currLimit: Optional[float] = None
    iMax: Optional[float] = None
    iMin: Optional[float] = None
    uMax: Optional[float] = None
    uMin: Optional[float] = None
    iterations: Optional[int] = None
    test_values: list = [[-0.000001,-0.000002],[-0.002, -0.065],[0.000003, 0.000005],[0.001, 0.006],[0.023, 0.017],[0.3, 0.55], [0.4, 0.66]]
    
class ReturnAPI(BaseModel):
    is_started: bool
    job_id: int
    message: str
    
class ReturnWebSocket(BaseModel):
    step: int
    current: float
    voltage: float
    
# manager for async message queue

class ConnectionManager:
    """Class defining socket events"""
    def __init__(self):
        self.active_connections = []
        self.queue = []
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(target=self.run_event_loop, args=(self.loop,))
        self.thread.start()
        asyncio.run_coroutine_threadsafe(self.run_queue(), self.loop)
        print("queue started")
    
    def run_event_loop(self, loop : asyncio.BaseEventLoop):
        """Run the event loop in the thread"""
        asyncio.set_event_loop(loop)
        loop.run_forever()
    
    async def connect(self, websocket: WebSocket):
        """connect event"""
        await websocket.accept()
        self.active_connections.append(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Direct Message"""
        await websocket.send_text(message)
        
    async def send_measure(self, message: str):
        """Direct Message"""
        if self.active_connections:
            await self.active_connections[0].send_text(message)
    
    def disconnect(self, websocket: WebSocket):
        """disconnect event"""
        self.active_connections.remove(websocket)
        
    def add_queue(self, message: str):
        self.queue.append(message) 
    
    async def run_queue(self):
        while True:
            if self.queue:
                message = self.queue.pop(0)
                await self.send_measure(message)
            await asyncio.sleep(0.1) 
    
# Main procedure

class MeasureProcedure(Procedure):
    
    def _generate_sweep_array(self, start: float, end: float, iterations: int, is_both_ways: bool):
        """
        Generates an array for the measurement sweep.
        """
        if not is_both_ways:
            return np.linspace(start, end, iterations)

        if iterations < 2:
            return np.linspace(start, end, iterations)
            
        if iterations % 2 == 1:
            num_up = (iterations + 1) // 2
            sweep_up = np.linspace(start, end, num_up)
            sweep_down = sweep_up[:-1][::-1] 
            return np.concatenate((sweep_up, sweep_down))
        else:
            num_half = iterations // 2
            sweep_up = np.linspace(start, end, num_half)
            sweep_down = np.linspace(end, start, num_half)
            return np.concatenate((sweep_up, sweep_down))

    id = IntegerParameter('Process id', default=999)
    iterations = IntegerParameter('Loop Iterations', default=100)
    delay = FloatParameter('Delay Time', units='ms', default=10)
    port = Parameter("port", "")
    DATA_COLUMNS = ['Voltage', 'Current']
    progress = FloatParameter('Progress %', units='%', default=0.0)
    source_type = Parameter("source type", default="VOLT")
    is_4_wire = Parameter("measurement type", default=True)
    is_both_ways = Parameter("measurement type", default=False)
   
    #voltage parameters
    compliance_current = FloatParameter('compliance current', units='A', default=0.03)
    voltage_start = FloatParameter('From voltage', units='V', default=0)
    voltage_end = FloatParameter('To voltage', units='V', default=1)
    
    #current parameters
    compliance_voltage = FloatParameter('compliance voltage', units='V', default=5)
    current_start = FloatParameter('From current', units='A', default=0)
    current_end = FloatParameter('To current', units='A', default=0.02)
    
    def startup(self):
        manager.add_queue("starting setup")
        log.info(f"Connecting to SMU at {self.port}")
        
        self.meter = Keithley2400Adapter(self.port)
        log.info("Setting up parameters")
        
        if self.source_type == "VOLT":
            voltage_sweep_limit = max(abs(self.voltage_start), abs(self.voltage_end))
            
            self.meter.configure_voltage_source(
                voltage_limit=voltage_sweep_limit, 
                compliance_current=self.compliance_current, 
                is_4_wire=self.is_4_wire
            )
            
            self.voltages = self._generate_sweep_array(
                self.voltage_start, self.voltage_end, self.iterations, self.is_both_ways
            )
            
            self.voltages = [float(x) for x in self.voltages]
            log.info(f"Generated {len(self.voltages)} voltage points for sweep.")
            self.meter.enable_source()
            
        elif self.source_type == "CURR":
            current_sweep_limit = max(abs(self.current_start), abs(self.current_end))
            
            self.meter.configure_current_source(
                current_limit=current_sweep_limit,
                compliance_voltage=self.compliance_voltage,
                is_4_wire=self.is_4_wire
            )
            
            self.currents = self._generate_sweep_array(
                self.current_start, self.current_end, self.iterations, self.is_both_ways
            )
            
            self.currents = [float(x) for x in self.currents]

            log.info(f"Generated {len(self.currents)} current points for sweep.")
            self.meter.enable_source()
            
        else:
            manager.add_queue("Pass correct parameters and try again")
        
        manager.add_queue("setup completed")
        
    def execute(self):
        
        if self.source_type == "VOLT":
            log.info("Starting to measure in VOLT mode")
            sweep_array = self.voltages
        elif self.source_type == "CURR":
            log.info("Starting to measure in CURR mode")
            sweep_array = self.currents
        else:
            log.error(f"Invalid source_type '{self.source_type}' in execute method.")
            manager.add_queue("Invalid parameters, stopping execution.")
            return

        for i, setpoint in enumerate(sweep_array):
        
            self.meter.source_value = setpoint
            sleep(self.delay/1000)

            if self.source_type == "VOLT":
                voltage = setpoint
                current = self.meter.measured_value
            else:
                current = setpoint
                voltage = self.meter.measured_value

            data = ReturnWebSocket(step=i, current=current, voltage=voltage)
            manager.add_queue(data.model_dump_json())
            self.progress = 100. * (i + 1) / self.iterations
            
            self.emit('results', data.model_dump())
            self.emit('progress', self.progress)

            if self.should_stop():
                log.warning("Catch stop command in procedure, ending measurement.")
                break
            

    def shutdown(self):
        self.meter.shutdown()
        self.meter.close()
        manager.add_queue("Finished")
        log.info("Finished")
        
# Procedure for easier testing without SMU present

class MeasureTestWebSocket(Procedure):

    id = IntegerParameter('Process id', default=999)
    iterations = IntegerParameter('Loop Iterations', default=100)
    delay = FloatParameter('Delay Time', units='s', default=0.1)
    port = Parameter("port", "")
    DATA_COLUMNS = ['Voltage', 'Current']
    progress = FloatParameter('Progress %', units='%', default=0.0)
    is_4_wire = Parameter("measurement type", default=True)
    is_both_ways = Parameter("measurement type", default=False)
    full_results = []
    test_data = []

    def startup(self):
        self.data = []
        manager.add_queue("Starting test run")
        
    def execute(self):
        log.info("Starting to measure")
        max_steps = min(self.iterations, len(self.test_data))
        for i, (voltage, current) in enumerate(self.test_data[:max_steps]):
            data = ReturnWebSocket(step=i, current=current, voltage=voltage)
            manager.add_queue(data.model_dump_json())
            log.debug("Produced numbers: %s" % data.model_dump())
            self.progress = 100. * i / self.iterations
            self.emit('results', data.model_dump())
            self.emit('progress', self.progress)
            sleep(self.delay)
            self.full_results.append(data.model_dump())
            if self.should_stop():
                log.warning("Catch stop command in procedure")
                break

    def shutdown(self):
        manager.add_queue("Finished")
        log.info("Finished")

#starting API, manager and worker for procedure

app = FastAPI()
manager = ConnectionManager()

worker: Optional[Worker] = None
   
#Api endpoints and websocket

@app.get("/")
def index() -> Response:
    return Response("server is running")

    
@app.get("/status")
def start() -> dict:
    FINISHED, FAILED, ABORTED, QUEUED, RUNNING = 0, 1, 2, 3, 4
    STATUS_STRINGS = {
        FINISHED: 'Finished', FAILED: 'Failed',
        ABORTED: 'Aborted', QUEUED: 'Queued',
        RUNNING: 'Running'
    }
    return {
        "status": {
            "id":procedure.status,
            "name": STATUS_STRINGS.get(procedure.status, "Unknown")
            },
        "id": procedure.id,
        "progress": procedure.progress
    }
    
@app.websocket("/com")
async def websocket_endpoint(websocket: WebSocket):
    global worker
    await manager.connect(websocket)
    try:
        while True:
            packet = await websocket.receive_text()
            print(packet)
            try:
                data = TestDataCommand.model_validate_json(packet)
            except ValidationError:
                try:
                    data = DataCommand.model_validate_json(packet)
                except ValidationError:
                    print("Validation error")
                    
            print(data)
            print(data.command)
            if data.command == "start":
                if 'procedure' in globals() and procedure.status == 4:
                    manager.add_queue('Cannot start: another measurement is running')
                    continue
                id = int(time.monotonic()*10)
                work_thread = threading.Thread(target=start_job, args=(data, id))
                work_thread.start()
            elif data.command == "stop":
                if worker is not None:
                    worker.stop() 
                    await manager.send_personal_message("Stopping backend", websocket)
            elif data.command == "test":
                if 'procedure' in globals() and procedure.status == 4:
                    manager.add_queue('Cannot start: another measurement is running')
                    continue
                id = int(time.monotonic()*10)
                work_thread = threading.Thread(target=test_job, args=(data, id))
                work_thread.start()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    
    
procedure: MeasureProcedure

#Function to start the measurement procedure (both actual and test)

def start_job(command: DataCommand, job_id: int):
    global procedure, worker, log
    _reset_root_logger_handlers(log)
    
    scribe = console_log(log, level=logging.DEBUG)
    scribe.start()

    filename = tempfile.mktemp()
    log.info("Using data file: %s" % filename)
    #start measuring procedure
    procedure = MeasureProcedure(port=f"ASRL{command.port}::INSTR", id=job_id)
    procedure.source_type= "VOLT" if command.isVoltSrc else "CURR"
    procedure.iterations = command.iterations
    procedure.delay = command.delay
    procedure.is_4_wire = command.is4Wire
    procedure.is_both_ways = command.isBothWays
    if command.isVoltSrc:
        #voltage measure parametres
        procedure.compliance_current = command.currLimit
        procedure.voltage_start = command.uMin
        procedure.voltage_end = command.uMax
    else:
        #current measure paramters
        procedure.compliance_voltage = command.voltLimit
        procedure.current_start = command.iMin
        procedure.current_end = command.iMax
    log.info(f"Set up Procedure with {procedure.iterations} iterations")
    
    results = Results(procedure, filename)
    log.info("Set up Results file")

    worker = Worker(results, scribe.queue, log_level=logging.DEBUG)
    log.info("Created worker for TestProcedure")
    log.info("Starting worker...")
    worker.start()
    

    log.info("Joining with the worker in at most 20 min")
    worker.join(command.timeout*60)
    log.info("Worker has joined")
    if procedure.status == 0:
            procedure.progress = 100.

    log.info("Stopping the logging")
    scribe.stop()
    
    
def test_job(command: TestDataCommand, job_id: int):
    global procedure, worker, log
    
    _reset_root_logger_handlers(log)
    scribe = console_log(log, level=logging.DEBUG)
    scribe.start()

    filename = tempfile.mktemp()
    log.info("Using data file: %s" % filename)

    procedure = MeasureTestWebSocket(port=f"ASRL{command.port}::INSTR", id=job_id, source_type="CURR")
    procedure.iterations = command.iterations
    procedure.delay = command.delay
    procedure.is_4_wire = command.is4Wire
    procedure.is_both_ways = command.isBothWays
    procedure.test_data = command.test_values
    log.info(f"Set up Procedure with {procedure.iterations} iterations")
    
    results = Results(procedure, filename)
    log.info("Set up Results file")

    worker = Worker(results, scribe.queue, log_level=logging.DEBUG)
    log.info("Created worker for TestProcedure")
    log.info("Starting worker...")
    worker.start()

    log.info("Joining with the worker in at most 20 min")
    worker.join(command.timeout*60)
    log.info("Worker has joined")
    if procedure.status == 0:
            procedure.progress = 100.

    log.info("Stopping the logging")
    scribe.stop()
    
#helper function to clear log handlers with multiple procedure calls    

def _reset_root_logger_handlers(logger_to_reset: logging.Logger):
    for handler in list(logger_to_reset.handlers): 
        logger_to_reset.removeHandler(handler)
        if hasattr(handler, 'close'): 
            try:
                handler.close()
            except Exception:
                pass 
    logger_to_reset.addHandler(logging.NullHandler())
    
#starting websockets listening when main is called
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)