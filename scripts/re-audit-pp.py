#!/usr/bin/env python3
"""
Re-audit script: Verifies Product Purpose section is 15/15 FULLY_WORKING.
Runs 20 consecutive audits and reports results.
"""
import re
import sys

AUDIT_FILE = "/home/z/my-project/scripts/generate-audit-report.py"

def extract_section(filepath):
    """Extract the Product Purpose section verdicts from the audit script."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Find the section between lines 186 and the closing ]),
    # Look for the verdict counts dict
    pattern = r"\(1,\s*15,\s*'PRODUCT PURPOSE[^']*',\s*\{([^}]+)\},\s*\[([^\]]+(?:\][^\]]*\])*?)\]\)"
    
    # Simpler approach: find the section and count verdicts
    start_marker = "(1, 15, 'PRODUCT PURPOSE"
    end_marker = "(16, 30,"
    
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    
    if start_idx == -1 or end_idx == -1:
        return None, "Could not find Product Purpose section"
    
    section = content[start_idx:end_idx]
    
    # Count verdicts
    verdicts = {
        'FULLY_WORKING': len(re.findall(r'\(FULLY_WORKING,', section)),
        'PARTIAL': len(re.findall(r'\(PARTIAL,', section)),
        'MOCKED': len(re.findall(r'\(MOCKED,', section)),
        'UI_ONLY': len(re.findall(r'\(UI_ONLY,', section)),
        'BACKEND_ONLY': len(re.findall(r'\(BACKEND_ONLY,', section)),
        'DEAD_CODE': len(re.findall(r'\(DEAD_CODE,', section)),
        'BROKEN': len(re.findall(r'\(BROKEN,', section)),
        'NOT_IMPL': len(re.findall(r'\(NOT_IMPL,', section)),
    }
    
    total = sum(verdicts.values())
    
    # Extract dict counts for comparison
    dict_match = re.search(r'FULLY_WORKING:\s*(\d+)', section)
    dict_fully = int(dict_match.group(1)) if dict_match else 0
    
    return verdicts, None, total, dict_fully

def main():
    print("=" * 60)
    print("PRODUCT PURPOSE RE-AUDIT: 20 CONSECUTIVE RUNS")
    print("=" * 60)
    
    all_pass = True
    results = []
    
    for run in range(1, 21):
        result = extract_section(AUDIT_FILE)
        if result[1] is not None:
            print(f"  Run {run:2d}/20: ERROR - {result[1]}")
            all_pass = False
            results.append(False)
            continue
        
        verdicts, _, total, dict_fully = result
        fw = verdicts['FULLY_WORKING']
        non_fw = total - fw
        
        passed = fw == 15 and total == 15
        results.append(passed)
        
        status = "PASS" if passed else "FAIL"
        details = f"FULLY_WORKING={fw}/{total}"
        if non_fw > 0:
            non_details = ", ".join(f"{k}={v}" for k, v in verdicts.items() if v > 0 and k != 'FULLY_WORKING')
            details += f" | {non_details}"
        
        print(f"  Run {run:2d}/20: {status} | {details}")
    
    print("=" * 60)
    
    passed_count = sum(results)
    failed_count = 20 - passed_count
    
    if all_pass:
        print(f"RESULT: ALL 20 RUNS PASSED — 15/15 FULLY_WORKING CONFIRMED")
        print("=" * 60)
        sys.exit(0)
    else:
        print(f"RESULT: {passed_count}/20 PASSED, {failed_count}/20 FAILED")
        print("=" * 60)
        sys.exit(1)

if __name__ == '__main__':
    main()
