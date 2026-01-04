# Rule Verification Command

You are an expert software engineer and prompt engineer specializing in Cursor rules and documentation quality.

Your task is to thoroughly verify that the provided rule is correct, complete, accurate, and follows best practices.

## Verification Process

Follow these steps systematically:

### 1. Rule Structure & Format

- [ ] Verify the rule has proper frontmatter (if applicable): `alwaysApply`, `description`, etc.
- [ ] Check that markdown formatting is correct and consistent
- [ ] Ensure code blocks have proper language tags
- [ ] Verify headings follow a logical hierarchy (H1 → H2 → H3)
- [ ] Check that the rule file extension matches the pattern (`.mdc` for markdown rules)

### 2. Content Accuracy

- [ ] **Code Examples**: For each code example in the rule:
  - Verify the code actually exists in the codebase (use `grep` or `codebase_search`)
  - Check that file paths are correct and files exist
  - Verify line numbers are accurate (if using code references)
  - Ensure code examples match the actual implementation
  - Check that imports and dependencies are correct
- [ ] **API References**: Verify all API methods, functions, and types mentioned exist
- [ ] **Configuration**: Check that configuration files, paths, and formats are accurate
- [ ] **Dependencies**: Verify mentioned packages, libraries, and versions are correct

### 3. Completeness

- [ ] Check if the rule covers all relevant scenarios and edge cases
- [ ] Verify that related concepts are explained or linked
- [ ] Ensure examples cover common use cases
- [ ] Check that error handling patterns are documented (if applicable)
- [ ] Verify that best practices are included (not just "how" but also "why")

### 4. Consistency & Redundancy

- [ ] Check for duplicate information within the rule
- [ ] Verify consistency with other rules in the codebase (check for conflicts)
- [ ] Ensure terminology is consistent throughout the rule
- [ ] Check that the rule doesn't contradict existing rules or documentation
- [ ] Verify that code patterns match actual codebase patterns

### 5. Clarity & Usability

- [ ] Verify the rule is clear and actionable
- [ ] Check that examples are easy to understand and follow
- [ ] Ensure the rule explains the "why" behind patterns, not just the "how"
- [ ] Verify that warnings and important notes are prominently displayed
- [ ] Check that the rule is scoped appropriately (not too broad, not too narrow)

### 6. Codebase Alignment

- [ ] Search the codebase to verify patterns mentioned in the rule are actually used
- [ ] Check that deprecated patterns are not recommended
- [ ] Verify that the rule aligns with the project's architecture and conventions
- [ ] Ensure the rule matches the current state of the codebase (not outdated)

### 7. Best Practices

- [ ] Verify the rule follows Cursor rule best practices
- [ ] Check that the rule is appropriately scoped (agent_requestable vs always_applied)
- [ ] Ensure the rule includes context about when it applies
- [ ] Verify that exceptions or special cases are documented

## Output Format

Provide your verification results in this format:

### ✅ Verified Aspects

- List aspects that are correct and complete

### ⚠️ Issues Found

- **Issue Type**: Description of the issue
  - **Location**: Where in the rule (line numbers, section)
  - **Impact**: How this affects usability/accuracy
  - **Recommendation**: Specific fix or improvement

### 📝 Suggested Improvements

- Specific, actionable improvements to enhance the rule

### 🔍 Verification Details

- List which files you checked
- List which code examples you verified
- Note any assumptions made during verification

## Rule to Verify

{{rule}}
