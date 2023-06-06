/**
 * attendance controller
 */

import { factories } from '@strapi/strapi'
import moment from "moment";
import {customError, customSuccess} from "../../../utils/app-response";
import {checkRequiredCredentials} from "../../../utils/credentials";

export default factories.createCoreController('api::attendance.attendance', ({ strapi }) => ({
  async attendancesByDate(ctx) {
    try {
      const { fromDate, toDate } = ctx.request.query

      const credentialsMap = new Map(
        [
          ['fromDate', fromDate],
          ['toDate', toDate]
        ]
      )

      const checkRC = checkRequiredCredentials(credentialsMap)
      if (!checkRC[0]) {
        return await customError(ctx, checkRC[1], 400)
      }

      const fromDateMoment = moment(fromDate)
      const toDateMoment = moment(toDate)
      const iter = Math.abs(toDateMoment.diff(fromDateMoment, 'days')) + 1

      let results = []
      let attendances = []
      const employeesAttendances = new Map()
      const employeesInfos = new Map()
      const employeesTotalWorkTimes = new Map()

      for (let i = 0; i < iter; i++) {
        const currentDate = fromDateMoment
        const date = currentDate.get('date')
        const month = currentDate.get('month') + 1
        const year = currentDate.get('year')
        const dateInNumber = year + (month * 2023) + date

        const todayAttendances = await strapi.entityService.findMany('api::attendance.attendance', {
          filters: {
            todayInNumber: dateInNumber,
            ...ctx.request.query.filters
          },
          populate: ['employee', 'company', 'absenceStatus', 'lateInStatus', 'earlyOutStatus']
        })

        if (todayAttendances.length) {
          attendances.push(...todayAttendances)
        }

        fromDateMoment.add(1, 'days')
      }

      for (const attendance of attendances) {
        if (!attendance.employee) {
          continue
        }
        const employeeId = attendance.employee.id
        const employeeAttendance = employeesAttendances.get(employeeId)
        const refactoredAttendance = {
          id: attendance.id,
          firstIn: attendance.firstIn,
          lastOut: attendance.lastOut,
          today: attendance.today,
          todayInNumber: attendance.todayInNumber,
          workTime: attendance.workTime,
          isAbsent: attendance.isAbsent,
          isLateIn: attendance.isLateIn,
          isEarlyOut: attendance.isEarlyOut,
          company: attendance.company,
          absenceStatus: attendance.absenceStatus,
          lateInStatus: attendance.lateInStatus,
          earlyOutStatus: attendance.earlyOutStatus
        }
        if (employeeAttendance) {
          employeeAttendance.push(refactoredAttendance)
          employeesAttendances.set(employeeId, employeeAttendance)
          if (refactoredAttendance.workTime) {
            employeesTotalWorkTimes.set(employeeId, employeesTotalWorkTimes.get(employeeId) + refactoredAttendance.workTime)
          }
        } else {
          employeesAttendances.set(employeeId, [refactoredAttendance])
          employeesTotalWorkTimes.set(employeeId, refactoredAttendance.workTime || 0)
        }

        const employeeInfo = employeesInfos.get(employeeId)
        if (!employeeInfo) {
          employeesInfos.set(employeeId, attendance.employee)
        }
      }

      for (const [employeeId, info] of employeesInfos) {
        results.push({
          id: employeeId,
          employee: info,
          attendances: employeesAttendances.get(employeeId),
          totalWorkTime: employeesTotalWorkTimes.get(employeeId)
        })
      }

      return await customSuccess(ctx, results)
    } catch (err) {
      strapi.log.error("error in function attendancesByDate, error: ", err)
      return await customError(ctx, 'internal server error', 500)
    }
  }
}));
