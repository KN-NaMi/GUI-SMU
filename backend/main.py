from fastapi import FastAPI, Response, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from pydantic_core import from_json
from typing import Optional
from time import sleep

import random, tempfile, threading, time, asyncio
import numpy as np

from pymeasure.log import console_log
from pymeasure.experiment import Procedure, IntegerParameter, Parameter, FloatParameter
from pymeasure.experiment import Results, Worker
from pymeasure.instruments.keithley import Keithley2400

import logging
log = logging.getLogger('')
log.addHandler(logging.NullHandler())


class DataCommand(BaseModel):
    command: Optional[str] = None
    port: str
    timeout: Optional[int] = 20 #minutes
    isVoltSrc: Optional[bool] = True
    voltLimit: Optional[float] = None
    currLimit: Optional[float] = None
    iMax: Optional[float] = None
    iMin: Optional[float] = None
    uMax: Optional[float] = None
    uMin: Optional[float] = None
    iterations: Optional[int] = None
    
class ReturnAPI(BaseModel):
    is_started: bool
    job_id: int
    message: str
    
class ReturnWebSocket(BaseModel):
    step: int
    current: float
    voltage: float
    

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
    


class MeasureProcedure(Procedure):
    
    voltage_ranges = [.2, 2, 20]
    current_ranges = [.000001, .00001, .0001, .001, .01, .1, 1]

    def nearest_largest_value (self, n, values):
        return min([v for v in values if v >= n] or [None])


    id = IntegerParameter('Process id', default=999)
    iterations = IntegerParameter('Loop Iterations', default=100)
    delay = FloatParameter('Delay Time', units='s', default=0.2)
    port = Parameter("port", "")
    DATA_COLUMNS = ['Voltage', 'Current']
    progress = FloatParameter('Progress %', units='%', default=0.0)
    source_type = Parameter("source type", default="VOLT")
   
    #voltage parameters
    compliance_current = FloatParameter('compliance current', units='A', default=0.03)
    voltage_min = FloatParameter('From voltage', units='V', default=0)
    voltage_max = FloatParameter('To voltage', units='V', default=20)
    
    #current parameters
    compliance_voltage = FloatParameter('compliance voltage', units='V', default=5)
    current_min = FloatParameter('From current', units='A', default=0)
    current_max = FloatParameter('To current', units='A', default=0.02)
    
    def startup(self):
        manager.add_queue("starting setup")
        log.info("Setting up connection to SMU")
        self.meter = Keithley2400(self.port)
        log.info("Setting up parameters")
        if self.source_type == "VOLT":
            self.meter.apply_voltage()  
            self.meter.measure_current()            
            self.meter.source_voltage_range =  self.nearest_largest_value(self.voltage_max, self.voltage_ranges)  
            self.meter.compliance_current = self.compliance_current
            self.voltages = np.linspace(self.voltage_min, self.voltage_max, self.iterations)
            print(self.voltages)
            self.voltages = [float(x) for x in self.voltages]
            print(self.voltages)
            self.meter.enable_source()
            manager.add_queue("setup completed")
        elif self.source_type == "CURR":
            pass
        else:
            manager.add_queue("Pass correct parameters and try again")
        
    def execute(self):
        
        if self.source_type == "VOLT":
            log.info("Starting to measure in VOLT mode")
            for v, voltage in enumerate(self.voltages):
                
                self.meter.source_voltage = voltage
                data = ReturnWebSocket(step=v, current=self.meter.current, voltage=voltage)
                manager.add_queue(data.model_dump_json())
                self.progress = 100. * v / self.iterations
                self.emit('results', data.model_dump())
                self.emit('progress', self.progress)
                if self.should_stop():
                    log.warning("Catch stop command in procedure")
                    break
        elif self.source_type == "CURR":
            pass
        else:
            manager.add_queue("Pass correct parameters and try again")
            

    def shutdown(self):
        self.meter.beep(3600, 1)
        time.sleep(0.2)
        self.meter.beep(3600, 0.5)
        self.meter.shutdown()
        self.meter.adapter.close()
        manager.add_queue("Finished")
        log.info("Finished")
        

class MeasureTestWebSocket(Procedure):

    id = IntegerParameter('Process id', default=999)
    iterations = IntegerParameter('Loop Iterations', default=100)
    delay = FloatParameter('Delay Time', units='s', default=0.2)
    port = Parameter("port", "")
    DATA_COLUMNS = ['Voltage', 'Current']
    progress = FloatParameter('Progress %', units='%', default=0.0)
    full_results = []

    def startup(self):
        self.data = []
        manager.add_queue("Starting test run")
        
    def execute(self):
        log.info("Starting to measure")
        for i in range(self.iterations):
            data = ReturnWebSocket(step=i, current=random.random(), voltage=random.random())
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

app = FastAPI()
manager = ConnectionManager()
   

@app.get("/")
def index() -> Response:
    return Response("server is running")

@app.get("/measure")
def start() -> ReturnAPI:
    if procedure.status == 4:
        return ReturnAPI(job_id=procedure.id, is_started=False, message="Process was already running")
    else:
        id = int(time.monotonic()*10)
        work_thread = threading.Thread(target=start_job, args=("ASRL7::INSTR", id))
        work_thread.start()
        ret_data = ReturnAPI(job_id=id, is_started=True, message="Process started")    
        return ret_data
    
    
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
    await manager.connect(websocket)
    try:
        while True:
            packet = await websocket.receive_text()
            print(packet)
            data = DataCommand.model_validate_json(packet)
            print(data)
            print(data.command)
            if data.command == "start":
                id = int(time.monotonic()*10)
                work_thread = threading.Thread(target=start_job, args=(data, id))
                work_thread.start()
            elif data.command == "stop":
                pass
            elif data.command == "test":
                id = int(time.monotonic()*10)
                work_thread = threading.Thread(target=test_job, args=(data, id))
                work_thread.start()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    
#"ASRL7::INSTR"
procedure: MeasureProcedure


def start_job(command: DataCommand, id: int):
    global procedure
    scribe = console_log(log, level=logging.DEBUG)
    scribe.start()

    filename = tempfile.mktemp()
    log.info("Using data file: %s" % filename)
    #start measuring procedure
    procedure = MeasureProcedure(port=f"ASRL{command.port}::INSTR", id=id)
    procedure.source_type= "VOLT" if command.isVoltSrc else "CURR"
    procedure.iterations = command.iterations
    procedure.delay = 0.1
    print(procedure.port)
    #voltage measure parametres
    procedure.compliance_current = command.currLimit
    procedure.voltage_min = command.uMin
    procedure.voltage_max = command.uMax
    #current measure paramters
    procedure.compliance_voltage = command.voltLimit
    procedure.current_min = command.iMin
    procedure.current_max = command.iMax
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
    
    
def test_job(command: DataCommand, id: int):
    global procedure
    scribe = console_log(log, level=logging.DEBUG)
    scribe.start()

    filename = tempfile.mktemp()
    log.info("Using data file: %s" % filename)

    procedure = MeasureTestWebSocket(port=f"ASRL{command.port}::INSTR", id=id, source_type="CURR")
    procedure.iterations = command.iterations
    procedure.delay = 0.1
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
    