;(function () {
  'use strict'

  let ERROR_COPY = {
    scope_denied: 'This app is not allowed to read runtime context.',
    context_unavailable: 'Runtime context is not available right now.',
    timeout: 'The host did not respond in time.',
    aborted: 'The request was cancelled.',
    host_unavailable: 'Open this app from AgentStudio to continue.',
    unsupported_protocol: 'This host version is not supported.',
    unsupported_request: 'This runtime request is not supported.',
    invalid_response: 'The host returned an invalid response.'
  }
  let attempt = 0
  let loadingState = document.getElementById('loading-state')
  let successState = document.getElementById('success-state')
  let errorState = document.getElementById('error-state')
  let status = document.getElementById('runtime-status')
  let errorMessage = document.getElementById('error-message')
  let retry = document.getElementById('retry')

  function setText(id, value) {
    document.getElementById(id).textContent = value
  }

  function showState(name) {
    loadingState.hidden = name !== 'loading'
    successState.hidden = name !== 'success'
    errorState.hidden = name !== 'error'
    loadingState.setAttribute('aria-busy', name === 'loading' ? 'true' : 'false')
  }

  function renderApprovedContext(context) {
    setText('tenant-name', context.tenant.name)
    setText('tenant-id', context.tenant.id)
    setText('user-name', context.user.display_name)
    setText('user-id', context.user.id)
    setText('app-name', context.app.name)
    setText('app-code', context.app.code)
    setText('app-version', context.app.version)
    status.textContent = 'Runtime context is ready.'
    showState('success')
  }

  function renderSafeRuntimeError(code) {
    errorMessage.textContent = ERROR_COPY[code] || ERROR_COPY.invalid_response
    status.textContent = 'Runtime context could not be loaded.'
    showState('error')
  }

  function loadContext() {
    attempt += 1
    let currentAttempt = attempt
    status.textContent = 'Reading runtime context...'
    showState('loading')

    let runtime = window.AgentStudioRuntime
    let request =
      runtime && typeof runtime.getContext === 'function'
        ? runtime.getContext()
        : Promise.reject({ code: 'host_unavailable' })

    Promise.resolve(request).then(
      function (context) {
        if (currentAttempt === attempt) renderApprovedContext(context)
      },
      function (error) {
        if (currentAttempt === attempt) renderSafeRuntimeError(error && error.code)
      }
    )
  }

  retry.addEventListener('click', loadContext)
  loadContext()
})()
