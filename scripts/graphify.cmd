@echo off
REM Wrapper script to run graphify commands
REM Usage: graphify query "What does authenticateToken do?"

python3 -m pip show graphifyy >/dev/null 2>&1
if errorlevel 1 (
  echo Installing graphifyy...
  python3 -m pip install graphifyy
)

REM Determine which Python has graphifyy
for /f "delims=" %%i in ('python3 -m pip show graphifyy 2^>/dev/null ^| findstr "Location"') do set GRAPHIFY_LOCATION=%%i

REM Try to run graphifyy as module
python3 -c "import graphifyy; import sys; sys.argv = ['graphify'] + sys.argv[1:]; graphifyy.main()" %*
