#!/usr/bin/env node
/**
 * Advanced Log Analyzer for Backend Logs
 * Provides insights, statistics, and error analysis
 * 
 * Usage:
 *   node analyze-logs.js                # Show all stats
 *   node analyze-logs.js --errors       # Show only errors
 *   node analyze-logs.js --today        # Show only today's logs
 *   node analyze-logs.js --api-calls    # Show API call statistics
 *   node analyze-logs.js --slow         # Show slow API calls (>1000ms)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const LOGS_DIR = path.join(__dirname, 'backend', 'logs');
const ARGS = process.argv.slice(2);

interface LogEntry {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  duration?: number;
  statusCode?: number;
  context?: any;
  error?: any;
}

class LogAnalyzer {
  private logs: LogEntry[] = [];
  private stats = {
    totalLogs: 0,
    byLevel: {} as Record<string, number>,
    byService: {} as Record<string, number>,
    apiCalls: [] as any[],
    errors: [] as any[],
    slowCalls: [] as any[],
  };

  async loadLogs() {
    if (!fs.existsSync(LOGS_DIR)) {
      console.error(`❌ Logs directory not found: ${LOGS_DIR}`);
      process.exit(1);
    }

    const files = fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.log'));

    if (files.length === 0) {
      console.error('❌ No log files found');
      process.exit(1);
    }

    console.log(`📂 Loading ${files.length} log files...`);

    for (const file of files) {
      const filePath = path.join(LOGS_DIR, file);
      const reader = readline.createInterface({
        input: fs.createReadStream(filePath),
      });

      for await (const line of reader) {
        try {
          const entry = JSON.parse(line);
          this.logs.push(entry);
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    }

    console.log(`✅ Loaded ${this.logs.length} log entries\n`);
  }

  analyze() {
    this.stats.totalLogs = this.logs.length;

    for (const log of this.logs) {
      // Count by level
      this.stats.byLevel[log.level] = (this.stats.byLevel[log.level] || 0) + 1;

      // Count by service
      this.stats.byService[log.service] = (this.stats.byService[log.service] || 0) + 1;

      // Track API calls
      if (log.service === 'ClinicalTrialsApiClient' && log.context?.statusCode) {
        this.stats.apiCalls.push({
          timestamp: log.timestamp,
          url: log.context.url,
          statusCode: log.context.statusCode,
          duration: log.context.duration,
          success: log.context.statusCode >= 200 && log.context.statusCode < 300,
        });
      }

      // Track errors
      if (log.level === 'ERROR') {
        this.stats.errors.push({
          timestamp: log.timestamp,
          service: log.service,
          message: log.message,
          error: log.error?.message,
        });
      }

      // Track slow calls
      if (log.context?.duration && log.context.duration > 1000) {
        this.stats.slowCalls.push({
          timestamp: log.timestamp,
          message: log.message,
          duration: log.context.duration,
          service: log.service,
        });
      }
    }
  }

  printGeneralStats() {
    console.log('=================================================');
    console.log('📊 Log Statistics');
    console.log('=================================================');
    console.log(`Total Entries: ${this.stats.totalLogs}`);
    console.log(`Date Range: ${this.logs[0]?.timestamp} to ${this.logs[this.logs.length - 1]?.timestamp}`);
    console.log('');

    console.log('By Log Level:');
    Object.entries(this.stats.byLevel)
      .sort((a, b) => b[1] - a[1])
      .forEach(([level, count]) => {
        const percentage = ((count / this.stats.totalLogs) * 100).toFixed(1);
        console.log(`  ${level.padEnd(6)} : ${count.toString().padStart(5)} (${percentage}%)`);
      });
    console.log('');

    console.log('By Service:');
    Object.entries(this.stats.byService)
      .sort((a, b) => b[1] - a[1])
      .forEach(([service, count]) => {
        console.log(`  ${service.padEnd(30)} : ${count.toString().padStart(5)}`);
      });
    console.log('');
  }

  printApiStats() {
    console.log('=================================================');
    console.log('🌐 API Call Statistics');
    console.log('=================================================');
    console.log(`Total API Calls: ${this.stats.apiCalls.length}`);

    if (this.stats.apiCalls.length === 0) {
      console.log('(No API calls recorded)');
      console.log('');
      return;
    }

    // By status code
    const byStatus: Record<number, number> = {};
    let totalDuration = 0;
    let successCount = 0;

    for (const call of this.stats.apiCalls) {
      byStatus[call.statusCode] = (byStatus[call.statusCode] || 0) + 1;
      if (call.duration) {
        totalDuration += call.duration;
      }
      if (call.success) {
        successCount++;
      }
    }

    console.log(`Successful: ${successCount} (${((successCount / this.stats.apiCalls.length) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${this.stats.apiCalls.length - successCount} (${(((this.stats.apiCalls.length - successCount) / this.stats.apiCalls.length) * 100).toFixed(1)}%)`);
    console.log('');

    if (totalDuration > 0) {
      console.log(`Average Duration: ${(totalDuration / this.stats.apiCalls.length).toFixed(0)}ms`);
      console.log(`Max Duration: ${Math.max(...this.stats.apiCalls.map(c => c.duration || 0))}ms`);
      console.log('');
    }

    console.log('By Status Code:');
    Object.entries(byStatus)
      .sort((a, b) => b[1] - a[1])
      .forEach(([code, count]) => {
        const percentage = ((count / this.stats.apiCalls.length) * 100).toFixed(1);
        console.log(`  ${code.padEnd(3)} : ${count.toString().padStart(5)} (${percentage}%)`);
      });
    console.log('');
  }

  printErrors() {
    if (this.stats.errors.length === 0) {
      console.log('✅ No errors recorded');
      console.log('');
      return;
    }

    console.log('=================================================');
    console.log(`❌ Error Log (${this.stats.errors.length} total)`);
    console.log('=================================================');

    // Group by service
    const byService: Record<string, any[]> = {};
    for (const error of this.stats.errors) {
      if (!byService[error.service]) {
        byService[error.service] = [];
      }
      byService[error.service].push(error);
    }

    for (const [service, errors] of Object.entries(byService)) {
      console.log(`\n${service} (${errors.length} errors):`);
      
      // Show most recent errors
      const recent = errors.slice(-3);
      for (const error of recent) {
        console.log(`  [${error.timestamp}] ${error.message}`);
        if (error.error) {
          console.log(`    Error: ${error.error}`);
        }
      }

      if (errors.length > 3) {
        console.log(`  ... and ${errors.length - 3} more`);
      }
    }
    console.log('');
  }

  printSlowCalls() {
    if (this.stats.slowCalls.length === 0) {
      console.log('⚡ All API calls completed in < 1 second');
      console.log('');
      return;
    }

    console.log('=================================================');
    console.log(`🐢 Slow API Calls (> 1000ms) - ${this.stats.slowCalls.length} found`);
    console.log('=================================================');

    this.stats.slowCalls
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
      .forEach(call => {
        console.log(`  [${call.timestamp}] ${call.duration}ms - ${call.message}`);
      });
    console.log('');
  }

  printErrorDetails() {
    console.log('=================================================');
    console.log('🔍 Detailed Error Analysis');
    console.log('=================================================');

    const errorsByType: Record<string, number> = {};

    for (const log of this.logs) {
      if (log.level === 'ERROR' && log.error) {
        const msg = log.error.message || log.error;
        errorsByType[msg] = (errorsByType[msg] || 0) + 1;
      }
    }

    if (Object.keys(errorsByType).length === 0) {
      console.log('✅ No errors found');
      console.log('');
      return;
    }

    console.log('Error Frequency:');
    Object.entries(errorsByType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([error, count]) => {
        console.log(`  [${count}x] ${error}`);
      });
    console.log('');
  }
}

async function main() {
  const analyzer = new LogAnalyzer();

  try {
    await analyzer.loadLogs();
    analyzer.analyze();

    const showAll = ARGS.length === 0;
    const showErrors = ARGS.includes('--errors');
    const showApiCalls = ARGS.includes('--api-calls');
    const showSlow = ARGS.includes('--slow');

    if (showAll || !showErrors && !showApiCalls && !showSlow) {
      analyzer.printGeneralStats();
      analyzer.printApiStats();
      analyzer.printErrors();
    }

    if (showErrors) {
      analyzer.printErrorDetails();
    }

    if (showApiCalls) {
      analyzer.printApiStats();
    }

    if (showSlow) {
      analyzer.printSlowCalls();
    }

    console.log('💾 For detailed log files, check:');
    console.log(`   ${LOGS_DIR}/`);
  } catch (error) {
    console.error('❌ Error analyzing logs:', error);
    process.exit(1);
  }
}

main();
