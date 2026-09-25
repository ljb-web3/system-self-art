export async function mockParticipantIdentity(page, { subjectNumber = 1024, failFirst = false } = {}) {
  const participants = new Map()
  const calls = []
  let shouldFail = failFirst

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

  return { calls, participants }
}

