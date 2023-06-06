export default {
  routes: [
    {
      method: 'POST',
      path: '/hikvision/logs/in',
      handler: 'event.hikvisionListeningIn',
      config: {}
    },
    {
      method: 'POST',
      path: '/hikvision/logs/out',
      handler: 'event.hikvisionListeningOut',
      config: {}
    },
    {
      method: 'GET',
      path: '/events/attendances',
      handler: 'event.attendances',
      config: {}
    },
  ]
}
