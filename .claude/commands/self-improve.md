---
description: Analyze previous conversation issues and improve documentation
---

# Self-Improvement Process

After identifying issues or problems in previous conversations, use this process to analyze what went wrong and improve documentation to prevent recurrence.

## Analysis Phase

### 1. Identify What Went Wrong

Review the previous conversation(s) and identify:

- **What was the problem?** (e.g., incorrect code pattern, missing context, misunderstanding)
- **What was the impact?** (e.g., wrong implementation, wasted time, confusion)
- **Why did it happen?** (e.g., unclear documentation, missing rule, outdated information)
- **When did it occur?** (e.g., during specific task type, with specific technology)

### 2. Root Cause Analysis

For each issue identified, determine:

- **Immediate cause**: What directly led to the problem?
- **Contributing factors**: What documentation, rules, or context was missing or unclear?
- **System gaps**: What documentation should have existed but didn't?

### 3. Pattern Detection

Look for recurring themes:

- Are there multiple similar issues?
- Do problems cluster around specific areas (e.g., Pub/Sub operations, React components)?
- Are there documentation gaps that keep causing problems?

## Documentation Review Phase

### 1. Review Relevant Rules

Read and analyze all relevant documentation files:

**Core Rules:**

- `.cursor/rules/react-tailwind.mdc` - UI development patterns
- `.cursor/rules/pubsub/pubsub.mdc` - GCP Pub/Sub guidelines
- `.cursor/rules/pubsub/message-publishing.mdc` - Message publishing patterns
- `.cursor/rules/pubsub/topics-and-subs.mdc` - Topic/subscription management
- `.cursor/rules/codacy.mdc` - Code quality rules
- `.cursor/rules/wails.mdc` - Go language guidelines
- `.cursor/rules/react-tailwind.mdc` - React Tailwind language guidelines for UI dev
- `.cursor/rules/goreleaser.mdc` - Release configuration

**Project Documentation:**

- `CLAUDE.md` - Project overview and architecture
- `PRD.md` - Product requirements and specifications

### 2. Verify Documentation Accuracy

For each relevant rule file:

- [ ] **Code examples**: Verify all code examples exist in the codebase and are accurate
- [ ] **File paths**: Check that referenced file paths are correct
- [ ] **Line numbers**: Verify code references use correct line numbers
- [ ] **API references**: Confirm all mentioned APIs, methods, and types exist
- [ ] **Patterns**: Verify documented patterns match actual codebase patterns
- [ ] **Dependencies**: Check that mentioned packages and versions are correct

### 3. Check for Gaps

Identify missing information:

- [ ] Are there patterns used in code that aren't documented?
- [ ] Are there edge cases or error scenarios not covered?
- [ ] Are there best practices that should be documented?
- [ ] Are there common mistakes that could be prevented with documentation?

### 4. Check for Clarity Issues

Review documentation for clarity:

- [ ] Is the documentation clear and actionable?
- [ ] Are examples easy to understand?
- [ ] Is the "why" explained, not just the "how"?
- [ ] Are warnings and important notes prominently displayed?
- [ ] Is the scope appropriate (not too broad, not too narrow)?

### 5. Check for Consistency

Verify consistency across documentation:

- [ ] Do rules contradict each other?
- [ ] Is terminology consistent?
- [ ] Do code patterns match across different rules?
- [ ] Are there duplicate or redundant sections?

## Improvement Phase

### 1. Update Existing Documentation

For each issue found:

1. **Identify the specific rule file(s) that need updates**
2. **Determine what needs to be added/changed:**
   - Missing information
   - Incorrect information
   - Unclear explanations
   - Missing examples
   - Missing warnings

3. **Make the updates:**
   - Add missing sections
   - Fix incorrect information
   - Clarify unclear explanations
   - Add examples for common scenarios
   - Add warnings for common mistakes
   - Update code references if needed

### 2. Create New Documentation (if needed)

If gaps require new documentation:

- Create new rule files in `.cursor/rules/` or `.cursor/rules/pubsub/`
- Follow the existing rule format (frontmatter, description, structured content)
- Include code examples from the actual codebase
- Reference related rules for context

### 3. Update Project Documentation

If needed, update:

- `CLAUDE.md` - Add architecture notes, common patterns, or important context
- `PRD.md` - Update if requirements or specifications changed

## Verification Phase

### 1. Verify Improvements

After making changes:

- [ ] Re-read the updated documentation to ensure clarity
- [ ] Verify all code examples still exist and are correct
- [ ] Check that file paths and line numbers are accurate
- [ ] Ensure no contradictions were introduced
- [ ] Confirm the documentation addresses the original issue

### 2. Test Documentation

Consider:

- Would the updated documentation have prevented the original issue?
- Is the documentation actionable and clear?
- Are examples relevant and helpful?

## Output Format

After completing the analysis, provide:

### 📊 Analysis Summary

- **Issues Identified**: List of problems found
- **Root Causes**: Why each issue occurred
- **Patterns**: Recurring themes or clusters

### 📝 Documentation Review Results

- **Files Reviewed**: List of documentation files checked
- **Issues Found**: Specific problems in documentation
- **Gaps Identified**: Missing information or patterns

### ✅ Improvements Made

- **Updated Files**: List of files modified
- **Changes Made**: Specific improvements
- **New Documentation**: Any new files created

### 🔍 Verification

- **Accuracy Check**: Confirmation that all code examples and references are correct
- **Clarity Check**: Confirmation that documentation is clear and actionable
- **Completeness Check**: Confirmation that gaps are filled

## Best Practices

- **Be thorough**: Don't skip steps or rush through analysis
- **Be specific**: Identify exact issues, not vague problems
- **Be actionable**: Make improvements that directly address root causes
- **Be consistent**: Follow existing documentation patterns and formats
- **Be accurate**: Always verify code examples and references against the codebase
- **Be forward-looking**: Consider how improvements prevent future issues

## Related Commands

- Use `verify-rule.md` to verify specific rule files after making changes
- Use `postmortem.md` for formal incident analysis and tracking
