import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  Col,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Steps,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  EditOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { storedToFormFields } from '../../context/quickCreateScheduleStorage'
import { useQuickCreateSchedule } from '../../context/QuickCreateScheduleContext'
import { listScreenGroups, listScreens } from '../../services/deviceService'
import { listLayouts } from '../../services/layoutService'
import { listPlaylistOptions } from '../../services/playlistService'
import {
  SCHEDULE_STATUSES,
  SCHEDULE_TARGET_TYPES,
  createSchedule,
  formValuesToScheduleRequest,
  getScheduleApiErrorMessage,
} from '../../services/scheduleService'

const STEP_ITEMS = [
  { title: 'Playlist' },
  { title: 'Layout' },
  { title: 'Target' },
  { title: 'Schedule' },
  { title: 'Review' },
]

const STEP_FIELD_KEYS = [
  ['playlistId'],
  ['layoutId'],
  ['targetType', 'screenId', 'screenGroupId'],
  ['scheduleName', 'startDatetime', 'endDatetime', 'priority', 'status', 'notes'],
  [],
]

const STATUS_OPTIONS = [
  { value: SCHEDULE_STATUSES.DRAFT, label: 'DRAFT' },
  { value: SCHEDULE_STATUSES.ACTIVE, label: 'ACTIVE' },
  { value: SCHEDULE_STATUSES.ENDED, label: 'ENDED' },
  { value: SCHEDULE_STATUSES.CANCELLED, label: 'CANCELLED' },
]

function formatDateTime(value) {
  if (value == null) return '—'
  const d = dayjs(value)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : String(value)
}

/** @param {{ message: string, children: import('react').ReactNode }} props */
function WizardStepHelper({ message, children }) {
  return (
    <Alert
      type="info"
      showIcon
      message={message}
      description={<Space wrap size={8}>{children}</Space>}
    />
  )
}

export default function QuickScheduleWizard() {
  const navigate = useNavigate()
  const {
    writable,
    active,
    modalOpen,
    currentStep,
    formValues,
    minimizeWizard,
    completeQuickCreate,
    clearQuickCreate,
    setCurrentStep,
    updateFormValues,
  } = useQuickCreateSchedule()

  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [playlists, setPlaylists] = useState([])
  const [layouts, setLayouts] = useState([])
  const [screens, setScreens] = useState([])
  const [screenGroups, setScreenGroups] = useState([])

  const targetTypeWatch = Form.useWatch('targetType', form)

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true)
    try {
      const [playlistsResult, layoutsResult, screensResult, groupsResult] =
        await Promise.allSettled([
          listPlaylistOptions(),
          listLayouts(),
          listScreens(),
          listScreenGroups(),
        ])

      setPlaylists(playlistsResult.status === 'fulfilled' ? playlistsResult.value || [] : [])
      setLayouts(
        layoutsResult.status === 'fulfilled'
          ? (layoutsResult.value || []).map((l) => ({
              id: l.id,
              name: l.name || `Layout #${l.id}`,
            }))
          : [],
      )
      setScreens(screensResult.status === 'fulfilled' ? screensResult.value || [] : [])
      setScreenGroups(groupsResult.status === 'fulfilled' ? groupsResult.value || [] : [])

      const failed = [playlistsResult, layoutsResult, screensResult, groupsResult].filter(
        (r) => r.status === 'rejected',
      )
      if (failed.length > 0) {
        message.warning(
          'Some wizard data could not be loaded. You can still continue where options are available.',
        )
      }
    } finally {
      setOptionsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!modalOpen || !active) return
    form.setFieldsValue(storedToFormFields(formValues))
    void loadOptions()
    // Restore persisted draft only when the modal is opened, not on every field sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen])

  const persistCurrentForm = useCallback(() => {
    updateFormValues(form.getFieldsValue(true))
  }, [form, updateFormValues])

  const handleNavigateAway = useCallback(
    (path) => {
      persistCurrentForm()
      minimizeWizard()
      navigate(path)
    },
    [persistCurrentForm, minimizeWizard, navigate],
  )

  const layoutMap = useMemo(() => new Map(layouts.map((l) => [l.id, l.name])), [layouts])
  const playlistMap = useMemo(() => new Map(playlists.map((p) => [p.id, p.name])), [playlists])
  const screenMap = useMemo(
    () =>
      new Map(
        screens.map((s) => [s.id, s.name || s.deviceCode || `Screen #${s.id}`]),
      ),
    [screens],
  )
  const groupMap = useMemo(
    () => new Map(screenGroups.map((g) => [g.id, g.name || `Group #${g.id}`])),
    [screenGroups],
  )

  const handleMinimize = () => {
    if (submitting) return
    persistCurrentForm()
    minimizeWizard()
  }

  const confirmCancelQuickCreate = () => {
    Modal.confirm({
      title: 'Cancel quick create?',
      content: 'This will discard your in-progress schedule draft and hide the reminder.',
      okText: 'Cancel quick create',
      okButtonProps: { danger: true },
      cancelText: 'Keep draft',
      onOk: () => {
        clearQuickCreate()
      },
    })
  }

  const goNext = async () => {
    const fields = STEP_FIELD_KEYS[currentStep]
    try {
      await form.validateFields(fields)
    } catch {
      return
    }
    persistCurrentForm()
    setCurrentStep(currentStep + 1)
  }

  const goPrev = () => {
    persistCurrentForm()
    setCurrentStep(currentStep - 1)
  }

  const handleSubmit = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }

    const persisted = storedToFormFields(formValues)
    const startDatetime = values.startDatetime ?? persisted.startDatetime
    const endDatetime = values.endDatetime ?? persisted.endDatetime

    setSubmitting(true)
    try {
      const body = formValuesToScheduleRequest({
        name: values.scheduleName ?? persisted.scheduleName,
        targetType: values.targetType ?? persisted.targetType,
        screenId: values.screenId ?? persisted.screenId,
        screenGroupId: values.screenGroupId ?? persisted.screenGroupId,
        layoutId: values.layoutId ?? persisted.layoutId,
        playlistId: values.playlistId ?? persisted.playlistId,
        startDatetime,
        endDatetime,
        priority: values.priority ?? persisted.priority,
        status: values.status ?? persisted.status,
      })

      await createSchedule(body)
      message.success('Schedule created successfully')
      completeQuickCreate()
      navigate('/schedules')
    } catch (e) {
      message.error(getScheduleApiErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (!writable || !active) {
    return null
  }

  const reviewValues = { ...storedToFormFields(formValues), ...form.getFieldsValue(true) }

  const renderPlaylistStep = () => (
    <Spin spinning={optionsLoading}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Form.Item
          name="playlistId"
          label="Playlist"
          rules={[{ required: true, message: 'Select a playlist' }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Select playlist"
            loading={optionsLoading}
            options={playlists.map((p) => ({
              value: p.id,
              label:
                p.itemCount > 0
                  ? `${p.name} (${p.itemCount} item${p.itemCount === 1 ? '' : 's'})`
                  : p.name,
            }))}
            notFoundContent={
              playlists.length === 0 ? (
                <Typography.Text type="secondary">No playlists available yet.</Typography.Text>
              ) : undefined
            }
          />
        </Form.Item>

        <WizardStepHelper message="Need a new or custom playlist?">
          <Button icon={<FolderOpenOutlined />} onClick={() => handleNavigateAway('/media')}>
            Go to Media Management
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => void loadOptions()} loading={optionsLoading}>
            Refresh
          </Button>
        </WizardStepHelper>
      </Space>
    </Spin>
  )

  const renderLayoutStep = () => (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Form.Item
        name="layoutId"
        label="Layout"
        rules={[{ required: true, message: 'Select a layout' }]}
      >
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="Select layout"
          loading={optionsLoading}
          options={layouts.map((l) => ({ value: l.id, label: l.name }))}
          notFoundContent={
            layouts.length === 0 ? (
              <Typography.Text type="secondary">No layouts yet.</Typography.Text>
            ) : undefined
          }
        />
      </Form.Item>

      <WizardStepHelper message="Need a new or custom layout?">
        <Button icon={<FolderOpenOutlined />} onClick={() => handleNavigateAway('/layouts')}>
          Go to Layout Management
        </Button>
        <Button icon={<EditOutlined />} onClick={() => handleNavigateAway('/layouts/editor')}>
          Open layout editor
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => void loadOptions()} loading={optionsLoading}>
          Refresh
        </Button>
      </WizardStepHelper>
    </Space>
  )

  const renderTargetStep = () => (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Form.Item
        name="targetType"
        label="Target type"
        rules={[{ required: true, message: 'Select target type' }]}
      >
        <Radio.Group>
          <Radio value={SCHEDULE_TARGET_TYPES.SCREEN}>Screen</Radio>
          <Radio value={SCHEDULE_TARGET_TYPES.GROUP}>Screen group</Radio>
        </Radio.Group>
      </Form.Item>

      {targetTypeWatch === SCHEDULE_TARGET_TYPES.SCREEN ? (
        <Form.Item
          name="screenId"
          label="Screen"
          rules={[{ required: true, message: 'Select a screen' }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Select screen"
            loading={optionsLoading}
            options={screens.map((s) => ({
              value: s.id,
              label:
                screenMap.get(s.id) ||
                `${s.name || s.deviceCode || `Screen #${s.id}`}${s.deviceCode ? ` (${s.deviceCode})` : ''}`,
            }))}
            notFoundContent={
              screens.length === 0 ? (
                <Typography.Text type="secondary">No screens registered yet.</Typography.Text>
              ) : undefined
            }
          />
        </Form.Item>
      ) : (
        <Form.Item
          name="screenGroupId"
          label="Screen group"
          rules={[{ required: true, message: 'Select a screen group' }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Select screen group"
            loading={optionsLoading}
            options={screenGroups.map((g) => ({
              value: g.id,
              label: groupMap.get(g.id) || g.name || `Group #${g.id}`,
            }))}
            notFoundContent={
              screenGroups.length === 0 ? (
                <Typography.Text type="secondary">No screen groups yet.</Typography.Text>
              ) : undefined
            }
          />
        </Form.Item>
      )}

      <WizardStepHelper message="Need to manage devices or screen groups?">
        <Button icon={<FolderOpenOutlined />} onClick={() => handleNavigateAway('/devices')}>
          Go to Device Management
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => void loadOptions()} loading={optionsLoading}>
          Refresh
        </Button>
      </WizardStepHelper>
    </Space>
  )

  const renderScheduleStep = () => (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Form.Item
        name="scheduleName"
        label="Schedule name"
        rules={[{ required: true, message: 'Enter a schedule name' }]}
      >
        <Input placeholder="e.g. Morning lobby schedule" />
      </Form.Item>

      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <Form.Item
            name="startDatetime"
            label="Start time"
            rules={[{ required: true, message: 'Select start time' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            name="endDatetime"
            label="End time"
            dependencies={['startDatetime']}
            rules={[
              { required: true, message: 'Select end time' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const start = getFieldValue('startDatetime')
                  if (!start || !value) return Promise.resolve()
                  if (dayjs(value).isAfter(dayjs(start))) return Promise.resolve()
                  return Promise.reject(new Error('End time must be after start time'))
                },
              }),
            ]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <Form.Item
            name="priority"
            label="Priority"
            rules={[{ required: true, message: 'Enter priority' }]}
          >
            <InputNumber min={0} max={999} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Select status' }]}
          >
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="notes" label="Notes (optional)">
        <Input.TextArea
          rows={3}
          placeholder="Internal notes for your team (not saved to the schedule record)"
          maxLength={500}
          showCount
        />
      </Form.Item>
    </Space>
  )

  const renderReviewStep = () => {
    const targetTypeLabel =
      reviewValues.targetType === SCHEDULE_TARGET_TYPES.GROUP ? 'Screen group' : 'Screen'
    const targetLabel =
      reviewValues.targetType === SCHEDULE_TARGET_TYPES.GROUP
        ? groupMap.get(reviewValues.screenGroupId) || reviewValues.screenGroupId || '—'
        : screenMap.get(reviewValues.screenId) || reviewValues.screenId || '—'

    return (
      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="Playlist">
          {playlistMap.get(reviewValues.playlistId) || reviewValues.playlistId || '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Layout">
          {layoutMap.get(reviewValues.layoutId) || reviewValues.layoutId || '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Target type">{targetTypeLabel}</Descriptions.Item>
        <Descriptions.Item label="Target">{targetLabel}</Descriptions.Item>
        <Descriptions.Item label="Time range">
          {formatDateTime(reviewValues.startDatetime)} ~ {formatDateTime(reviewValues.endDatetime)}
        </Descriptions.Item>
        <Descriptions.Item label="Priority">{reviewValues.priority ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Status">
          <Tag>{reviewValues.status || SCHEDULE_STATUSES.DRAFT}</Tag>
        </Descriptions.Item>
        {reviewValues.notes?.trim() ? (
          <Descriptions.Item label="Notes">{reviewValues.notes.trim()}</Descriptions.Item>
        ) : null}
      </Descriptions>
    )
  }

  const stepContent = [
    renderPlaylistStep(),
    renderLayoutStep(),
    renderTargetStep(),
    renderScheduleStep(),
    renderReviewStep(),
  ][currentStep]

  return (
    <Modal
      title="Quick create schedule"
      open={modalOpen}
      onCancel={handleMinimize}
      width={820}
      maskClosable={false}
      footer={
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space wrap>
            <Button danger onClick={confirmCancelQuickCreate} disabled={submitting}>
              Cancel quick create
            </Button>
            <Button onClick={handleMinimize} disabled={submitting}>
              Minimize
            </Button>
          </Space>
          <Space wrap>
            {currentStep > 0 ? (
              <Button icon={<ArrowLeftOutlined />} onClick={goPrev} disabled={submitting}>
                Back
              </Button>
            ) : null}
            {currentStep < STEP_ITEMS.length - 1 ? (
              <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => void goNext()}>
                Next
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={submitting}
                onClick={() => void handleSubmit()}
              >
                Create schedule
              </Button>
            )}
          </Space>
        </Space>
      }
    >
      <Steps current={currentStep} size="small" items={STEP_ITEMS} style={{ marginBottom: 24 }} />

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        preserve
        onValuesChange={() => {
          persistCurrentForm()
        }}
      >
        <div style={{ minHeight: 280 }}>{stepContent}</div>
      </Form>
    </Modal>
  )
}
