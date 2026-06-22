import { Badge, Button } from 'antd'
import { CalendarOutlined } from '@ant-design/icons'
import { useQuickCreateSchedule } from '../../context/QuickCreateScheduleContext'

const STEP_LABELS = ['Playlist', 'Layout', 'Target', 'Schedule', 'Review']

export default function QuickCreateScheduleFloater() {
  const { writable, active, modalOpen, currentStep, openWizard } = useQuickCreateSchedule()

  if (!writable || !active || modalOpen) {
    return null
  }

  const stepLabel = STEP_LABELS[currentStep] || 'In progress'

  return (
    <div
      style={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        zIndex: 1100,
      }}
    >
      <Badge count={currentStep + 1} offset={[-4, 4]} color="#1a5fb4">
        <Button
          type="primary"
          size="large"
          icon={<CalendarOutlined />}
          onClick={openWizard}
          style={{
            borderRadius: 12,
            fontWeight: 600,
            height: 48,
            paddingInline: 20,
            boxShadow: '0 8px 24px rgba(26, 95, 180, 0.35)',
          }}
        >
          Quick create in progress
          <span style={{ marginLeft: 8, fontWeight: 400, opacity: 0.9 }}>
            · {stepLabel}
          </span>
        </Button>
      </Badge>
    </div>
  )
}
