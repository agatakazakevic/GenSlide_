"""
Task Manager - Manages background tasks and job queue
"""

import asyncio
from typing import Dict, Any, Optional, Callable
from datetime import datetime
from enum import Enum
import uuid


class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Task:
    """Represents a background task"""
    
    def __init__(
        self,
        task_id: str,
        task_type: str,
        func: Callable,
        args: tuple = (),
        kwargs: dict = None
    ):
        self.task_id = task_id
        self.task_type = task_type
        self.func = func
        self.args = args
        self.kwargs = kwargs or {}
        
        self.status = TaskStatus.PENDING
        self.created_at = datetime.now()
        self.started_at = None
        self.completed_at = None
        self.result = None
        self.error = None
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert task to dictionary"""
        return {
            'task_id': self.task_id,
            'task_type': self.task_type,
            'status': self.status.value,
            'created_at': self.created_at.isoformat(),
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'result': self.result,
            'error': self.error
        }


class TaskManager:
    """Manages background task execution"""
    
    def __init__(self, max_concurrent_tasks: int = 5):
        self.max_concurrent_tasks = max_concurrent_tasks
        self.tasks: Dict[str, Task] = {}
        self.queue = asyncio.Queue()
        self.workers = []
        self.is_running = False
        
    async def start(self):
        """Start task workers"""
        if self.is_running:
            return
        
        self.is_running = True
        
        # Start worker tasks
        for i in range(self.max_concurrent_tasks):
            worker = asyncio.create_task(self._worker(i))
            self.workers.append(worker)
    
    async def stop(self):
        """Stop task workers"""
        self.is_running = False
        
        # Wait for current tasks to complete
        await self.queue.join()
        
        # Cancel workers
        for worker in self.workers:
            worker.cancel()
        
        await asyncio.gather(*self.workers, return_exceptions=True)
        self.workers.clear()
    
    async def submit_task(
        self,
        task_type: str,
        func: Callable,
        args: tuple = (),
        kwargs: dict = None
    ) -> str:
        """
        Submit a task for execution
        
        Returns:
            task_id: Unique task identifier
        """
        task_id = str(uuid.uuid4())
        
        task = Task(
            task_id=task_id,
            task_type=task_type,
            func=func,
            args=args,
            kwargs=kwargs
        )
        
        self.tasks[task_id] = task
        await self.queue.put(task)
        
        return task_id
    
    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get task status"""
        task = self.tasks.get(task_id)
        return task.to_dict() if task else None
    
    def cancel_task(self, task_id: str) -> bool:
        """Cancel a pending task"""
        task = self.tasks.get(task_id)
        
        if task and task.status == TaskStatus.PENDING:
            task.status = TaskStatus.CANCELLED
            return True
        
        return False
    
    async def _worker(self, worker_id: int):
        """Background worker for executing tasks"""
        while self.is_running:
            try:
                # Get task from queue
                task = await asyncio.wait_for(
                    self.queue.get(),
                    timeout=1.0
                )
                
                # Check if cancelled
                if task.status == TaskStatus.CANCELLED:
                    self.queue.task_done()
                    continue
                
                # Execute task
                task.status = TaskStatus.RUNNING
                task.started_at = datetime.now()
                
                try:
                    if asyncio.iscoroutinefunction(task.func):
                        result = await task.func(*task.args, **task.kwargs)
                    else:
                        result = task.func(*task.args, **task.kwargs)
                    
                    task.result = result
                    task.status = TaskStatus.COMPLETED
                    
                except Exception as e:
                    task.error = str(e)
                    task.status = TaskStatus.FAILED
                
                finally:
                    task.completed_at = datetime.now()
                    self.queue.task_done()
                
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Worker {worker_id} error: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get task statistics"""
        status_counts = {
            'pending': 0,
            'running': 0,
            'completed': 0,
            'failed': 0,
            'cancelled': 0
        }
        
        for task in self.tasks.values():
            status_counts[task.status.value] += 1
        
        return {
            'total_tasks': len(self.tasks),
            'queue_size': self.queue.qsize(),
            'active_workers': len(self.workers),
            'max_concurrent': self.max_concurrent_tasks,
            **status_counts
        }
    
    def is_healthy(self) -> bool:
        """Check if task manager is healthy"""
        return self.is_running
