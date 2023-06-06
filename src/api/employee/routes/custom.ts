export default {
  routes: [
    {
      method: 'POST',
      path: '/v2/employees/create',
      handler: 'employee.createEmployee',
    },
    {
      method: 'DELETE',
      path: '/v2/employees/delete/:id',
      handler: 'employee.deleteEmployee',
    },
    {
      method: 'PUT',
      path: '/v2/employees/update/:id',
      handler: 'employee.updateEmployee',
    },
    {
      method: 'POST',
      path: '/v2/employees/make-admin/:id',
      handler: 'employee.makeAdminEmployee',
    },
    {
      method: 'POST',
      path: '/v2/employees/make-not-admin/:id',
      handler: 'employee.makeNotAdminEmployee',
    },
    {
      method: 'GET',
      path: '/v2/employees/me',
      handler: 'employee.meEmployee',
    },
    {
      method: 'GET',
      path: '/dashboards/home/stats',
      handler: 'employee.dashboardStats',
      config: {}
    },
    {
      method: 'GET',
      path: '/employees/collect-all-employees',
      handler: 'employee.collectAllEmployees',
      config: {}
    },
    {
      method: 'GET',
      path: '/employees/collect-all-events',
      handler: 'employee.collectAllEvents',
      config: {}
    },
    {
      method: 'GET',
      path: '/employees/create-delete-fake-employees',
      handler: 'employee.createDeleteFakeEmployees',
      config: {}
    },
    {
      method: 'DELETE',
      path: '/employees/delete-test-entities',
      handler: 'employee.deleteTestEntities',
      config: {}
    }
  ]
}
