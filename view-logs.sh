#!/bin/bash
#
# Log Viewer Utility
# Parse and display structured logs from the backend
# Usage: ./view-logs.sh [--level DEBUG|INFO|WARN|ERROR] [--service SERVICE] [--lines 50] [--today]
#

LOG_DIR="backend/logs"
LOG_LEVEL=""
SERVICE=""
LINES=50
TODAY_ONLY=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --level)
      LOG_LEVEL="$2"
      shift 2
      ;;
    --service)
      SERVICE="$2"
      shift 2
      ;;
    --lines)
      LINES="$2"
      shift 2
      ;;
    --today)
      TODAY_ONLY="true"
      shift
      ;;
    --help)
      echo "Log Viewer Utility"
      echo "Usage: ./view-logs.sh [options]"
      echo ""
      echo "Options:"
      echo "  --level LEVEL       Filter by log level (DEBUG, INFO, WARN, ERROR)"
      echo "  --service SERVICE   Filter by service name"
      echo "  --lines N           Show last N lines (default: 50)"
      echo "  --today             Show only today's logs"
      echo "  --help              Show this help message"
      echo ""
      echo "Examples:"
      echo "  ./view-logs.sh --level ERROR                    # Show all errors"
      echo "  ./view-logs.sh --service ClinicalTrialsApiClient # Show only API client logs"
      echo "  ./view-logs.sh --level ERROR --lines 100        # Show last 100 error lines"
      echo "  ./view-logs.sh --today                          # Show only today's logs"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [ ! -d "$LOG_DIR" ]; then
  echo "❌ Log directory not found: $LOG_DIR"
  echo "Run the backend first to generate logs."
  exit 1
fi

echo "================================================="
echo "Log Viewer - Backend API Logs"
echo "================================================="
echo "Log Directory: $LOG_DIR"
echo "Level Filter: ${LOG_LEVEL:-'All'}"
echo "Service Filter: ${SERVICE:-'All'}"
echo "Show Last: $LINES lines"
echo "================================================="
echo ""

# Find and process log files
if [ "$TODAY_ONLY" = "true" ]; then
  TODAY=$(date '+%Y-%m-%d')
  LOG_FILES="$LOG_DIR/*$TODAY*.log"
else
  LOG_FILES="$LOG_DIR/*.log"
fi

# If specific level, look for those files
if [ -n "$LOG_LEVEL" ]; then
  LOG_FILES_PATTERN="$LOG_DIR/${LOG_LEVEL,,}-*.log"
else
  LOG_FILES_PATTERN="$LOG_DIR/*.log"
fi

# Count matching files
FILE_COUNT=$(ls $LOG_FILES_PATTERN 2>/dev/null | wc -l)

if [ $FILE_COUNT -eq 0 ]; then
  echo "❌ No log files found matching criteria"
  echo ""
  echo "Available log files:"
  ls -lh "$LOG_DIR"/ 2>/dev/null || echo "  (directory is empty)"
  exit 1
fi

echo "📄 Found $FILE_COUNT log file(s)"
echo ""

# Stream and parse logs
jq_filter='.'

if [ -n "$LOG_LEVEL" ]; then
  jq_filter="$jq_filter | select(.level == \"$LOG_LEVEL\")"
fi

if [ -n "$SERVICE" ]; then
  jq_filter="$jq_filter | select(.service | contains(\"$SERVICE\"))"
fi

# Display logs with nice formatting
cat $LOG_FILES_PATTERN 2>/dev/null | \
  while IFS= read -r line; do
    # Try to parse as JSON and format nicely
    if command -v jq &> /dev/null; then
      echo "$line" | jq -r "\"[\(.timestamp)] \(.level) [\(.service)] \(.message)\(if .duration then \" (\(.duration)ms)\" else \"\" end)\(if .statusCode then \" [\(.statusCode)]\" else \"\" end)\"" 2>/dev/null || echo "$line"
    else
      # Fallback to grep if jq not available
      echo "$line" | grep -E "\"level\":.*\"${LOG_LEVEL:-.*}\"" 2>/dev/null || echo "$line"
    fi
  done | tail -n "$LINES"

echo ""
echo "================================================="
echo "✅ End of logs"
echo "================================================="

# Show summary statistics
echo ""
echo "📊 Log Summary"
echo "-------------------------------------------------"

if command -v jq &> /dev/null; then
  for file in $LOG_FILES_PATTERN; do
    if [ -f "$file" ]; then
      echo "File: $(basename $file)"
      echo "  Total entries: $(wc -l < "$file")"
      
      if [ "$TODAY_ONLY" != "true" ]; then
        echo "  By level:"
        grep '"level"' "$file" | grep -o '"level":"[^"]*"' | cut -d'"' -f4 | sort | uniq -c | while read count level; do
          printf "    %s: %d\n" "$level" "$count"
        done
      fi
    fi
  done
else
  echo "Install jq for better log parsing: sudo apt install jq"
  echo ""
  echo "Log files:"
  ls -lh $LOG_FILES_PATTERN
fi
