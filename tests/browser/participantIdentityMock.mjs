export async function mockExperiment00StudyState(
  page,
  { initialRecords = {}, failFirstSave = false } = {},
) {
  const records = new Map(Object.entries(initialRecords))
  const getCalls = []
  const saveCalls = []
  let shouldFailSave = failFirstSave
  let clock = Date.now()

  await page.route('**/rest/v1/rpc/get_experiment_00_study_state', async route => {
    const { p_participant_id: participantId } = route.request().postDataJSON()
    getCalls.push(participantId)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(records.has(participantId) ? [records.get(participantId)] : []),
    })
  })

  await page.route('**/rest/v1/rpc/save_experiment_00_study_state', async route => {
    const body = route.request().postDataJSON()
    saveCalls.push(body)

    if (shouldFailSave) {
      shouldFailSave = false
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Temporary study save failure' }),
      })
      return
    }

    const participantId = body.p_participant_id
    const payload = body.p_payload
    const previous = records.get(participantId)
    clock += 1000
    const record = {
      participant_id: participantId,
      current_step: payload.current_step,
      welcome_age: payload.welcome_age,
      welcome_country: payload.welcome_country || null,
      welcome_gender: payload.welcome_gender || null,
      welcome_ethnicity: payload.welcome_ethnicity || null,
      part_01_data: payload.part_01_data,
      part_02_data: payload.part_02_data,
      part_03_data: payload.part_03_data,
      part_04_data: payload.part_04_data,
      part_05_data: payload.part_05_data,
      created_at: previous?.created_at ?? new Date(clock).toISOString(),
      updated_at: new Date(clock).toISOString(),
    }
    records.set(participantId, record)

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([record]),
    })
  })

  return {
    records,
    getCalls,
    saveCalls,
    failNextSave() {
      shouldFailSave = true
    },
  }
}

export async function mockParticipantIdentity(
  page,
  { subjectNumber = 1024, failFirst = false, study = {} } = {},
) {
  const participants = new Map()
  const calls = []
  let shouldFail = failFirst
  const studyApi = await mockExperiment00StudyState(page, study)

  await page.route('**/rest/v1/rpc/get_or_create_experiment_00_participant', async route => {
    const requestBody = route.request().postDataJSON()
    const participantId = requestBody.p_participant_id
    calls.push(participantId)

    if (shouldFail) {
      shouldFail = false
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Temporary identity service failure' }),
      })
      return
    }

    if (!participants.has(participantId)) {
      participants.set(participantId, {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        participant_id: participantId,
        subject_number: subjectNumber + participants.size,
        created_at: '2026-09-25T00:00:00.000Z',
        updated_at: '2026-09-25T00:00:00.000Z',
      })
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([participants.get(participantId)]),
    })
  })

  return { calls, participants, study: studyApi }
}
