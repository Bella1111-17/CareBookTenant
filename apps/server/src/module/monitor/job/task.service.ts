import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Task, TaskRegistry } from 'src/common/decorators/task.decorator';
import { JobLogService } from './job-log.service';
import { TenantCareService } from 'src/module/tenant-care/tenant-care.service';

@Injectable()
export class TaskService implements OnModuleInit {
  private readonly logger = new Logger(TaskService.name);
  // eslint-disable-next-line @typescript-eslint/ban-types
  private readonly taskMap = new Map<string, Function>();
  private serviceInstances = new Map<string, any>();

  constructor(
    private moduleRef: ModuleRef,
    private jobLogService: JobLogService,
    private tenantCareService: TenantCareService,
  ) {}

  onModuleInit() {
    this.initializeTasks();
  }

  private async initializeTasks() {
    const tasks = TaskRegistry.getInstance().getTasks();

    for (const { classOrigin, methodName, metadata } of tasks) {
      try {
        let serviceInstance = this.serviceInstances.get(classOrigin.name);
        if (!serviceInstance) {
          serviceInstance = await this.moduleRef.get(classOrigin, { strict: false });
          this.serviceInstances.set(classOrigin.name, serviceInstance);
        }

        const method = serviceInstance[methodName].bind(serviceInstance);
        this.taskMap.set(metadata.name, method);
        this.logger.log(`Registered task: ${metadata.name}`);
      } catch (error) {
        this.logger.error(`Failed to register task ${metadata.name}: ${error.message}`);
      }
    }
  }

  getTasks() {
    return Array.from(this.taskMap.keys());
  }

  async executeTask(invokeTarget: string, jobName?: string, jobGroup?: string) {
    const startTime = new Date();
    let status = '0';
    let jobMessage = 'Execute success';
    let exceptionInfo = '';

    try {
      const regex = /^([^(]+)(?:\((.*)\))?$/;
      const match = invokeTarget.match(regex);

      if (!match) {
        throw new Error('Invalid invoke target format');
      }

      const [, methodName, paramsStr] = match;
      const params = paramsStr ? this.parseParams(paramsStr) : [];
      const taskFn = this.taskMap.get(methodName);
      if (!taskFn) {
        throw new Error(`Task ${methodName} does not exist`);
      }

      await taskFn(...params);
      return true;
    } catch (error) {
      status = '1';
      jobMessage = 'Execute failed';
      exceptionInfo = error.message;
      this.logger.error(`Task execution failed: ${error.message}`);
      return false;
    } finally {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      await this.jobLogService.addJobLog({
        jobName: jobName || 'Unknown task',
        jobGroup: jobGroup || 'DEFAULT',
        invokeTarget,
        status,
        jobMessage: `${jobMessage}, cost ${duration}ms`,
        exceptionInfo,
        createTime: startTime,
      });
    }
  }

  private parseParams(paramsStr: string): any[] {
    if (!paramsStr.trim()) {
      return [];
    }

    try {
      const normalizedStr = paramsStr.replace(/'/g, '"').replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
      return Function(`return [${normalizedStr}]`)();
    } catch (error) {
      this.logger.error(`Failed to parse task params: ${error.message}`);
      return [];
    }
  }

  @Task({
    name: 'task.noParams',
    description: 'No-parameter sample task',
  })
  async noParams() {
    this.logger.log('Execute no-parameter sample task');
  }

  @Task({
    name: 'task.params',
    description: 'Parameterized sample task',
  })
  async params(param1: string, param2: number, param3: boolean) {
    this.logger.log(`Execute parameterized sample task: ${JSON.stringify({ param1, param2, param3 })}`);
  }

  @Task({
    name: 'task.clearTemp',
    description: 'Clear temporary files',
  })
  async clearTemp() {
    this.logger.log('Clear temporary files task is not implemented yet');
  }

  @Task({
    name: 'task.monitorSystem',
    description: 'Monitor system status',
  })
  async monitorSystem() {
    this.logger.log('Monitor system task is not implemented yet');
  }

  @Task({
    name: 'task.nurseDailyReport',
    description: 'Generate tenant AI daily reports for caregiver-bound devices',
  })
  async nurseDailyReport(dateStr?: string) {
    const normalizedDate = String(dateStr || '').trim() || undefined;
    const result = await this.tenantCareService.generateScheduledDailyReports(normalizedDate);
    this.logger.log(`Tenant AI daily report task finished: ${JSON.stringify(result)}`);
  }
}
