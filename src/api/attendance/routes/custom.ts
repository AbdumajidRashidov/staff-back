export default {
  routes: [
    {
      method: 'GET',
      path: '/v2/attendances/by-date',
      handler: 'attendance.attendancesByDate',
    }
  ]
}
