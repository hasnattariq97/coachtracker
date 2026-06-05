# Phase 7 Frontend - Test Examples

## 1. CoachingInsightCard Component Rendering

### Example Notification Data:
```json
{
  "id": 42,
  "user_id": 2,
  "task_id": 5,
  "task_title": "Q2 Strategy",
  "type": "coaching_insights",
  "message": "Great work on deadline execution! Consider applying this approach to future complex tasks.",
  "metadata": {
    "pattern_agent": {
      "summary": "You're 85% on-time — strong execution",
      "confidence": 0.92
    },
    "growth_agent": {
      "summary": "Great execution on deadline pressure",
      "confidence": 0.88
    },
    "risk_agent": {
      "summary": "No risks detected",
      "confidence": 0.95
    },
    "consensus": "Keep it up! Your deadline management is getting stronger.",
    "generated_at": "2026-06-05T15:30:00Z"
  },
  "insights_status": "success",
  "read": 0,
  "created_at": "2026-06-05T15:30:00Z"
}
```

### Visual Output:
```
┌─────────────────────────────────────────────────────────┐
│ [Teal left border]                                      │
│ Keep it up! Your deadline management is getting stronger│
│                                                         │
│ ┌───────────────────────────────────────────────────┐ │
│ │ 💡 Growth Opportunity                             │ │
│ │ Great execution on deadline pressure              │ │
│ └───────────────────────────────────────────────────┘ │
│                                                         │
│ ▼ Show Details                                          │
│ Dismiss                                                 │
└─────────────────────────────────────────────────────────┘
```

---

## 2. NotificationBell Integration - type='coaching_insights' Detection

### Test Case: Conditional Rendering
```javascript
// In NotificationBell.jsx
{notifications.map(n => (
  <div key={n.id} className="mb-3">
    {n.type === 'coaching_insights' ? (
      // ✅ Route to special card for coaching insights
      <CoachingInsightCard
        notification={n}
        onDismiss={() => markAsRead(n.id)}
      />
    ) : (
      // Standard notification for other types
      <div className="bg-white border-l-4 border-teal-600...">
        ...
      </div>
    )}
  </div>
))}
```

### Example Scenarios:

**Scenario A: Mixed notifications (assorted types)**
```
Notification 1: type='assigned'          → Standard notification card
Notification 2: type='coaching_insights' → CoachingInsightCard ✅
Notification 3: type='completed'         → Standard notification card
Notification 4: type='coaching_insights' → CoachingInsightCard ✅
Notification 5: type='overdue'           → Standard notification card
```

**Scenario B: All coaching insights**
```
Notification 1: type='coaching_insights' → CoachingInsightCard
Notification 2: type='coaching_insights' → CoachingInsightCard
Notification 3: type='coaching_insights' → CoachingInsightCard
All render with expandable details & orange Growth Opportunity
```

---

## 3. Expandable Details Section - Confidence Scores

### Collapsed State (Default):
```
┌─────────────────────────────────────────┐
│ Keep it up! Your deadline management... │
│                                         │
│ [Orange Growth Opportunity section]     │
│                                         │
│ ▼ Show Details                          │
│ Dismiss                                 │
└─────────────────────────────────────────┘
```

### Expanded State (After clicking "Show Details"):
```
┌─────────────────────────────────────────┐
│ Keep it up! Your deadline management... │
│                                         │
│ [Orange Growth Opportunity section]     │
│                                         │
│ ▲ Hide Details                          │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Pattern Analysis                    │ │
│ │ You're 85% on-time — strong         │ │
│ │ execution                           │ │
│ │ Confidence: 92%                     │ │
│ │                                     │ │
│ │ ─────────────────────────────────── │ │
│ │                                     │ │
│ │ Risk Analysis                       │ │
│ │ No risks detected                   │ │
│ │ Confidence: 95%                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Dismiss                                 │
└─────────────────────────────────────────┘
```

### Test Data with Varying Confidence:
```javascript
// Example 1: High confidence scores
{
  pattern_agent: { summary: "Pattern text", confidence: 0.95 },  // 95%
  growth_agent: { summary: "Growth text", confidence: 0.88 },    // 88%
  risk_agent: { summary: "Risk text", confidence: 0.92 }         // 92%
}

// Example 2: Mixed confidence
{
  pattern_agent: { summary: "Pattern text", confidence: 0.65 },  // 65%
  growth_agent: { summary: "Growth text", confidence: 0.78 },    // 78%
  risk_agent: { summary: "Risk text", confidence: 0.85 }         // 85%
}

// Example 3: Low confidence (uncertain analysis)
{
  pattern_agent: { summary: "Pattern text", confidence: 0.52 },  // 52%
  growth_agent: { summary: "Growth text", confidence: 0.61 },    // 61%
  risk_agent: { summary: "Risk text", confidence: 0.58 }         // 58%
}
```

---

## 4. Orange-Highlighted Growth Opportunity Section

### HTML Structure:
```html
<!-- Orange highlight with left border -->
<div class="bg-orange-50 border-l-2 border-orange-500 pl-3 py-2 rounded">
  <div class="flex items-start gap-2">
    <!-- Lightbulb icon (orange) -->
    <Lightbulb class="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
    <div>
      <!-- Orange heading -->
      <p class="text-xs font-semibold text-orange-900">Growth Opportunity</p>
      <!-- Orange body text -->
      <p class="text-xs text-orange-800 mt-1">Great execution on deadline pressure</p>
    </div>
  </div>
</div>
```

### Tailwind Classes Used:
- **Background**: `bg-orange-50` (light orange)
- **Border**: `border-l-2 border-orange-500` (orange left border)
- **Icon**: `text-orange-600` (medium orange)
- **Heading**: `text-orange-900` (dark orange)
- **Body text**: `text-orange-800` (dark orange)

### Visual Examples:

**Example 1: Completion Success**
```
┌─────────────────────────────────┐
│ 💡 Growth Opportunity            │ ← Orange highlight
│ Great execution on deadline      │
│ pressure — keep this momentum    │
└─────────────────────────────────┘
```

**Example 2: Skill Development**
```
┌─────────────────────────────────┐
│ 💡 Growth Opportunity            │ ← Orange highlight
│ Consider breaking larger tasks   │
│ into smaller milestones next     │
└─────────────────────────────────┘
```

**Example 3: Strength Recognition**
```
┌─────────────────────────────────┐
│ 💡 Growth Opportunity            │ ← Orange highlight
│ Your time management under       │
│ pressure is exceptional          │
└─────────────────────────────────┘
```

---

## 5. Coaching-Tone Messaging Examples

### Pattern Agent (Historical Analysis):
```
✓ "You're 85% on-time — strong execution"
✓ "Excels with 3-5 day deadlines"
✓ "Consistent completion rate improving monthly"
✓ "Monday deadlines show higher accuracy"
```

### Growth Agent (Learning Opportunities):
```
✓ "Great execution on deadline pressure — consider this approach for future complex tasks"
✓ "Your time management under pressure is exceptional"
✓ "Consider breaking larger tasks into smaller milestones"
✓ "Strong accountability — keep building on this strength"
```

### Risk Agent (Blocker Detection):
```
✓ "No risks detected — keep this momentum going"
✓ "Watch for: End-of-week deadline clustering"
✓ "Pattern detected: Complex tasks + external dependencies = delays"
✓ "Recurring: Friday submissions taking longer — consider earlier starts"
```

### Consensus Messages:
```
✓ "Keep it up! Your deadline management is getting stronger."
✓ "Great progress — apply this execution style to future work."
✓ "Strong week! Channel this momentum into next month's challenges."
✓ "Insights partial. Continue strong work!"
```

---

## Test Checklist for Frontend Features

### CoachingInsightCard Rendering
- [ ] Component accepts `notification` and `onDismiss` props
- [ ] Parses `metadata` JSON from notification
- [ ] Renders fallback UI when metadata is null/missing
- [ ] Displays consensus message at top
- [ ] Shows coaching-tone text

### NotificationBell Integration
- [ ] Detects `type === 'coaching_insights'`
- [ ] Routes to CoachingInsightCard for coaching insights
- [ ] Routes to standard card for other types
- [ ] Works with mixed notification types
- [ ] Dismiss callback triggers `markAsRead()`

### Expandable Details
- [ ] "Show Details" button toggles state
- [ ] "Hide Details" button toggles state
- [ ] Pattern Analysis section displays when expanded
- [ ] Risk Analysis section displays when expanded
- [ ] Confidence scores show as percentages (e.g., "92%")
- [ ] Sections properly styled with gray background

### Orange Growth Opportunity
- [ ] Background color is `bg-orange-50` (light orange)
- [ ] Left border is `border-orange-500` (orange)
- [ ] Lightbulb icon renders in orange
- [ ] "Growth Opportunity" heading in dark orange
- [ ] Summary text in dark orange
- [ ] Visually distinct from other notification types

### Coaching-Tone Messaging
- [ ] Pattern agent uses "you're", "excels", "improving" language
- [ ] Growth agent uses "great", "strong", "consider" language
- [ ] Risk agent uses "watch for", "pattern detected" language
- [ ] Consensus ties findings together positively
- [ ] No generic/corporate language ("please", "must", "required")
- [ ] All messages are encouraging and growth-focused

---

## Integration Test Scenarios

### Scenario 1: Coach Completes Task
```
1. Coach clicks "Mark Complete" on task
2. Backend triggers coaching_insights job
3. 3 agents analyze coach behavior (1-2 seconds)
4. Notification created with metadata
5. NotificationBell detects type='coaching_insights'
6. CoachingInsightCard renders with:
   - Coaching-tone consensus message
   - Orange-highlighted Growth Opportunity
   - Expandable Pattern & Risk Analysis
   - Confidence scores (85-95%)
7. Coach clicks "Show Details" → reveals full analysis
8. Coach clicks "Dismiss" → marks as read
✅ Result: Coach sees personalized coaching insights
```

### Scenario 2: Multiple Notification Types
```
Notification Bell has 5 notifications:
1. type='assigned' → Standard card
2. type='coaching_insights' → CoachingInsightCard (Orange!)
3. type='midpoint_nudge' → Standard card
4. type='coaching_insights' → CoachingInsightCard (Orange!)
5. type='overdue' → Standard card

✅ Result: Coaching insights visually prominent, easy to distinguish
```

### Scenario 3: Confidence Score Variations
```
Low confidence (52-65%):
- Pattern Agent: "Possibly 60% on-time"
- Growth Agent: "Consider reviewing task approach"
- Risk Agent: "Minor pattern: external blocks"

High confidence (85-95%):
- Pattern Agent: "85% on-time — strong execution"
- Growth Agent: "Exceptional deadline management"
- Risk Agent: "No risks detected"

✅ Result: Confidence scores help coach understand analysis certainty
```

