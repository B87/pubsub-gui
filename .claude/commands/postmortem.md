---
alwaysApply: true
---

# Postmortem Process

After fixing a bug or incident, create a postmortem report to improve processes and prevent recurrence.

## When to Create a Postmortem

- **Critical bugs**: Production issues affecting users or data integrity
- **Security incidents**: Any security vulnerability or breach
- **Performance degradation**: Significant performance issues
- **Data loss**: Any data corruption or loss
- **Recurring issues**: Problems that happen multiple times
- **Process failures**: When established processes fail

## Postmortem Report Template

Create a new file: `.cursor/postmortems/YYYY-MM-DD-incident-title.md`

```markdown
# Postmortem: [Incident Title]

**Date**: YYYY-MM-DD
**Severity**: [Critical/High/Medium/Low]
**Status**: [Resolved/In Progress/Mitigated]
**Reported by**: [Name]
**Resolved by**: [Name]

## Executive Summary
[2-3 sentence overview of what happened, impact, and current status]

## Timeline
- **Detected**: YYYY-MM-DD HH:MM
- **Escalated**: YYYY-MM-DD HH:MM
- **Mitigation Started**: YYYY-MM-DD HH:MM
- **Resolved**: YYYY-MM-DD HH:MM
- **Total Downtime/Impact**: [Duration]

## Impact Assessment
- **Users Affected**: [Number/Percentage]
- **Data Affected**: [Description]
- **Service Degradation**: [Description]
- **Business Impact**: [Description]

## Incident Description
[Detailed description of what happened, symptoms, and user experience]

## Root Cause Analysis
[Deep dive into why this happened. Use the "5 Whys" technique if helpful]

### Immediate Cause
[What directly caused the issue]

### Contributing Factors
- [Factor 1]
- [Factor 2]
- [Factor 3]

### System/Process Gaps
[What systems, processes, or documentation were missing or inadequate]

## Resolution
[How the issue was fixed, including steps taken]

### Immediate Actions Taken
1. [Action 1]
2. [Action 2]
3. [Action 3]

### Long-term Fix
[Permanent solution implemented]

## Prevention Measures

### Immediate (Completed)
- [ ] [Action item with owner and deadline]
- [ ] [Action item with owner and deadline]

### Short-term (Next Sprint)
- [ ] [Action item with owner and deadline]
- [ ] [Action item with owner and deadline]

### Long-term (Next Quarter)
- [ ] [Action item with owner and deadline]
- [ ] [Action item with owner and deadline]

## Improvements & Recommendations

### Process Improvements
- [Improvement 1]
- [Improvement 2]

### Technical Improvements
- [Improvement 1]
- [Improvement 2]

### Documentation Updates
- [ ] Update [document/file] with [information]
- [ ] Add [new documentation] for [process/feature]

### Monitoring & Alerting
- [ ] Add alert for [condition]
- [ ] Improve monitoring for [metric/system]

## Lessons Learned
[Key takeaways that can be applied more broadly]

### What Went Well
- [Positive aspect 1]
- [Positive aspect 2]

### What Could Be Improved
- [Improvement area 1]
- [Improvement area 2]

### Questions to Explore
- [Question 1]
- [Question 2]

## Related Issues/PRs
- Issue: #[number]
- PR: #[number]
- Related Postmortem: [link]

## Follow-up Actions
- [ ] Review this postmortem in [timeframe]
- [ ] Verify all action items are completed
- [ ] Update runbooks/playbooks
- [ ] Share learnings with team
- [ ] Update incident response procedures
```

## Postmortem Workflow

1. **Create the report** using the template above
2. **Complete all sections** thoroughly and honestly
3. **Assign action items** with clear owners and deadlines
4. **Update documentation** immediately:
   - Update relevant `.cursor/rules/` files
   - Update `CLAUDE.md` if needed
   - Update code comments if the fix reveals important context
   - Create or update runbooks/playbooks
5. **Review past postmortems** (quarterly) to identify patterns
6. **Track action items** until completion
7. **Share learnings** with the team

## Self-Improvement Mechanisms

### Quarterly Postmortem Review

Every quarter, review all postmortems to:

- Identify recurring patterns or themes
- Assess if prevention measures were effective
- Update processes based on learnings
- Archive or consolidate outdated information

### Postmortem Effectiveness Check

After 30 days, verify:

- [ ] All action items completed
- [ ] Documentation updated
- [ ] Prevention measures implemented
- [ ] No recurrence of the issue
- [ ] Team aware of changes

### Continuous Improvement

- Track postmortem metrics (frequency, resolution time, recurrence rate)
- Regularly update this template based on what works
- Share successful prevention strategies across projects
- Document patterns that lead to incidents

## Best Practices

- **Blameless**: Focus on systems and processes, not individuals
- **Timely**: Create postmortem within 48 hours of resolution
- **Actionable**: Every action item should have an owner and deadline
- **Transparent**: Share learnings with the team
- **Comprehensive**: Don't skip sections, even if they seem obvious
- **Follow-up**: Track action items to completion
