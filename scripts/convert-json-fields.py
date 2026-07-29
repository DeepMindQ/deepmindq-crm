"""
Phase 1.5: JSON-in-String → Json type conversion script.
Converts identified Prisma String fields to Json type in schema.prisma.
"""

import re

SCHEMA_PATH = '/home/z/my-project/prisma/schema.prisma'

# Fields to convert: (model_name, field_name, default_value)
# Grouped by model for organized changes
FIELDS_TO_CONVERT = [
    # StrategicInsight
    ('StrategicInsight', 'keyThemes', '[]'),
    ('StrategicInsight', 'reasoningSummary', '{}'),
    ('StrategicInsight', 'supportingEvidence', '[]'),
    
    # AIEngagementStrategy  
    ('AIEngagementStrategy', 'situationAssessment', '{}'),
    ('AIEngagementStrategy', 'recommendedEntry', '{}'),
    ('AIEngagementStrategy', 'conversationAngles', '[]'),
    ('AIEngagementStrategy', 'riskFactors', '[]'),
    
    # IntelligenceObject
    ('IntelligenceObject', 'keySignals', '[]'),
    ('IntelligenceObject', 'themes', '[]'),
    ('IntelligenceObject', 'recentChanges', '[]'),
    ('IntelligenceObject', 'opportunityAreas', '[]'),
    ('IntelligenceObject', 'risks', '[]'),
    ('IntelligenceObject', 'evidenceReferences', '[]'),
    ('IntelligenceObject', 'sourceIntelligenceIds', '[]'),
    ('IntelligenceObject', 'scoreBreakdown', '{}'),
    
    # ReasoningContext
    ('ReasoningContext', 'recommendedActions', '[]'),
    ('ReasoningContext', 'matchedCapabilities', '[]'),
    ('ReasoningContext', 'matchedCaseStudies', '[]'),
    ('ReasoningContext', 'competitivePosition', '{}'),
    
    # ReasoningStep
    ('ReasoningStep', 'output', None),  # no default, required field
    ('ReasoningStep', 'evidenceIds', '[]'),
    ('ReasoningStep', 'knowledgeIds', '[]'),
    ('ReasoningStep', 'dependsOnSteps', '[]'),
    
    # AgentOrchestration
    ('AgentOrchestration', 'outputSummary', '{}'),
    ('AgentOrchestration', 'inputContext', '{}'),
    ('AgentOrchestration', 'output', None),
    ('AgentOrchestration', 'dependsOn', '[]'),
    
    # ContinuousLearning
    ('ContinuousLearning', 'applicableContext', '{}'),
    ('ContinuousLearning', 'applicableTags', '[]'),
    
    # KnowledgeAsset
    ('KnowledgeAsset', 'metadata', '{}'),
    ('KnowledgeAsset', 'keywords', '[]'),
    
    # ConversationPlan (from conversation-studio-engine)
    # These may be in different models - check
    
    # FusionResult
    ('FusionResult', 'signalIds', '[]'),
    ('FusionResult', 'capabilityIds', '[]'),
    ('FusionResult', 'evidenceIds', '[]'),
    ('FusionResult', 'proofPoints', '[]'),
    ('FusionResult', 'reasoningChain', '[]'),
    
    # DataUpload
    ('DataUpload', 'columnMapping', '{}'),
    ('DataUpload', 'rawData', '{}'),
    ('DataImportRow', 'mappedData', None),
    ('DataImportRow', 'normalizedData', None),
    ('DataImportRow', 'validationIssues', None),
    ('DataImportRow', 'suggestedCorrections', None),
    ('DataImportRow', 'appliedCorrections', None),
    
    # FieldValidationRule
    ('FieldValidationRule', 'config', '{}'),
    
    # IntelligenceHealth
    ('IntelligenceHealth', 'confidenceBreakdown', '{}'),
    ('IntelligenceHealth', 'changedFields', '{}'),
    ('IntelligenceHealth', 'metrics', '{}'),
    
    # Signal
    ('Signal', 'metadata', '{}'),
    
    # AIEventLog  
    ('AIEventLog', 'metadata', '{}'),
    
    # ConnectorRun
    ('ConnectorRun', 'config', '{}'),
    
    # TriggeredAlert
    ('TriggeredAlert', 'triggerDetails', None),
    ('TriggeredAlert', 'whyNowReasons', None),
    
    # SystemSetting
    ('SystemSetting', 'value', '""'),
]

with open(SCHEMA_PATH, 'r') as f:
    content = f.read()

converted = 0
errors = []

for model, field, default_val in FIELDS_TO_CONVERT:
    # Pattern: field_name  String   @default("...") // JSON: ...
    # We need to change "String" to "Json" for this specific field in this specific model
    
    # Find the model block
    model_pattern = rf'(model {model} \{{[^}}]*?)(}})'
    model_match = re.search(model_pattern, content, re.DOTALL)
    
    if not model_match:
        # Try multi-line search - the model may span many lines with nested braces
        # Find "model X {" and count braces to find end
        model_start_pattern = rf'^model {model} {{'
        lines = content.split('\n')
        model_start = None
        brace_count = 0
        model_end = None
        for i, line in enumerate(lines):
            if re.match(model_start_pattern, line.strip()):
                model_start = i
                brace_count = 0
            if model_start is not None:
                brace_count += line.count('{') - line.count('}')
                if brace_count == 0:
                    model_end = i
                    break
        
        if model_start is None:
            errors.append(f"Model {model} not found in schema")
            continue
        
        model_block = '\n'.join(lines[model_start:model_end+1])
    else:
        model_block = model_match.group(0)
    
    # Now find the field line within this model block
    # Pattern variations:
    # field_name   String   @default("[]") // JSON: ...
    # field_name   String   @default("{}") // JSON: ...
    # field_name   String?  // JSON: ...
    # field_name   String   // JSON: ...
    
    field_pattern = rf'^\s+{field}\s+String'
    
    lines_block = model_block.split('\n')
    field_line_idx = None
    for i, line in enumerate(lines_block):
        if re.match(field_pattern, line):
            field_line_idx = i
            break
    
    if field_line_idx is None:
        errors.append(f"Field {model}.{field} not found or not String type")
        continue
    
    old_line = lines_block[field_line_idx]
    
    # Determine the replacement
    if default_val:
        # String @default("[]") → Json @default("[]")  (note: no @db.Text needed)
        # String? @default("[]") → Json? @default("[]")
        new_line = re.sub(r'\bString\b', 'Json', old_line)
    else:
        # Required field without default
        # field_name   String   // JSON: ...
        new_line = re.sub(r'\bString\b', 'Json', old_line)
    
    if new_line == old_line:
        errors.append(f"Field {model}.{field}: no change (line: {old_line.strip()})")
        continue
    
    # Replace in full content
    old_full = old_line
    # Find this line in the full content
    # Since model blocks can be large, search for the line within the model
    content = content.replace(old_full, new_line, 1)
    converted += 1

# Write back
with open(SCHEMA_PATH, 'w') as f:
    f.write(content)

print(f"Converted {converted} fields")
if errors:
    print(f"\nErrors ({len(errors)}):")
    for e in errors:
        print(f"  - {e}")
