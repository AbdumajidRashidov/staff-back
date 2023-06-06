export default {
  routes: [
    {
      method: 'GET',
      path: '/lang/:lang',
      handler: 'translation.getByLang',
      config: {}
    },
    {
      method: 'POST',
      path: '/set/lang',
      handler: 'translation.setLang',
      config: {}
    }
  ]
}
