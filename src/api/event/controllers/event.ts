/**
 * event controller
 */

import { factories } from '@strapi/strapi'
import {customError, customSuccess} from "../../../utils/app-response";
import md5 from 'md5';
import {Employee} from "../../employee/dto/employee";
import moment from "moment/moment";

export default factories.createCoreController('api::event.event', ({ strapi }) => ({
  async hikvisionListeningIn(ctx) {
    try {
      const hikvisions = await strapi.entityService.findMany('api::hikvision.hikvision', {})
      const hikvisionId = hikvisions.find(hikvision => hikvision.type === 'in')?.id
      const { event_log } = ctx.request.body
      const eventLogObj = JSON.parse(event_log)
      const { AccessControllerEvent: { serialNo, employeeNoString, name, currentVerifyMode, mask, majorEventType, subEventType } } = eventLogObj
      const _hash = md5(serialNo + eventLogObj.dateTime + mask + currentVerifyMode + majorEventType + subEventType + name + `hikvision_${hikvisionId}`)

      const validate = await this.isSubTypeValid(eventLogObj.AccessControllerEvent)
      if(!validate) {
        return await customSuccess(ctx, null)
      }

      const employeeId = employeeNoString.split("emp")[1]
      await strapi.entityService.create('api::event.event', {
        data: {
          employee: employeeId,
          name: name,
          date: eventLogObj.dateTime,
          currentVerifyMode: currentVerifyMode,
          mask: mask,
          major: majorEventType,
          subType: subEventType,
          hash: _hash,
          hikvision: hikvisionId,
        }
      })

      const eventDateTime = moment(eventLogObj.dateTime)
      const date = eventDateTime.get('date')
      const month = eventDateTime.get('month') + 1
      const year = eventDateTime.get('year')
      const dateInNumber = year + (month * 2023) + date

      const [ company ] = await strapi.entityService.findMany('api::company.company', {})
      const attendanceStatuses = await strapi.entityService.findMany('api::attendance-status.attendance-status', {
        filters: {
          company: company.id
        }
      })
      const lateInAttendanceStatus = attendanceStatuses.find((status) => status.key === 'lateIn')
      const [ workStartH, workStarM ] = moment(company.workStartTime).format('HH:mm').split(':').map((time) => parseInt(time))
      const workTimeOffset = company.workTimeOffset
      const workStartTimeInMinutes = workStartH * 60 + workStarM - workTimeOffset

      const [ attendance ] = await strapi.entityService.findMany('api::attendance.attendance', {
        filters: {
          employee: employeeId,
          todayInNumber: dateInNumber
        }
      })

      let isLateIn = false
      const [ peTimeH, peTimeM ] = eventDateTime.format('HH:mm').split(':').map((item) => parseInt(item))
      const outTimeInMinutes = peTimeH * 60 + peTimeM
      if (outTimeInMinutes > workStartTimeInMinutes) {
        isLateIn = true
      }
      if (attendance) {
        await strapi.entityService.update('api::attendance.attendance', attendance.id, {
          data: {
            firstIn: eventLogObj.dateTime,
            isLateIn: isLateIn,
            earlyOutStatus: isLateIn ? lateInAttendanceStatus.id : null,
            isAbsent: false,
            absenceStatus: null
          }
        })
      } else {
        await strapi.entityService.create('api::attendance.attendance', {
          data: {
            employee: employeeId,
            firstIn: eventLogObj.dateTime,
            isAbsent: false,
            absenceStatus: null,
            today: eventDateTime.format('YYYY-MM-DD'),
            todayInNumber: dateInNumber,
            company: company.id,
            isLateIn: isLateIn,
            isEarlyOut: false,
            lateInStatus: isLateIn ? lateInAttendanceStatus.id : null,
          }
        })
      }


      return await customSuccess(ctx, null)
    } catch (e) {
      console.log("error in listening logs hikvisionListeningIn", e)
      return await customError(ctx, e.message, 500)
    }
  },
  async hikvisionListeningOut(ctx) {
    try {
      const hikvisions = await strapi.entityService.findMany('api::hikvision.hikvision', {})
      const hikvisionId = hikvisions.find(hikvision => hikvision.type === 'out')?.id
      const { event_log } = ctx.request.body
      const eventLogObj = JSON.parse(event_log)
      const { AccessControllerEvent: { serialNo, employeeNoString, name, currentVerifyMode, mask, majorEventType, subEventType } } = eventLogObj
      const _hash = md5(serialNo + eventLogObj.dateTime + mask + currentVerifyMode + majorEventType + subEventType + name + `hikvision_${hikvisionId}`)

      const validate = await this.isSubTypeValid(eventLogObj.AccessControllerEvent)
      if(!validate) {
        return await customSuccess(ctx, null)
      }

      const employeeId = employeeNoString.split("emp")[1]
      await strapi.entityService.create('api::event.event', {
        data: {
          employee: employeeId,
          name: name,
          date: eventLogObj.dateTime,
          currentVerifyMode: currentVerifyMode,
          mask: mask,
          major: majorEventType,
          subType: subEventType,
          hash: _hash,
          hikvision: hikvisionId,
        }
      })

      const eventDateTime = moment(eventLogObj.dateTime)
      const date = eventDateTime.get('date')
      const month = eventDateTime.get('month') + 1
      const year = eventDateTime.get('year')
      const dateInNumber = year + (month * 2023) + date

      const [ company ] = await strapi.entityService.findMany('api::company.company', {})
      const attendanceStatuses = await strapi.entityService.findMany('api::attendance-status.attendance-status', {
        filters: {
          company: company.id
        }
      })
      const earlyOutAttendanceStatus = attendanceStatuses.find((status) => status.key === 'earlyOut')
      const [ workEndH, workEndTimeM ] = moment(company.workEndTime).format('HH:mm').split(':').map((time) => parseInt(time))
      const workTimeOffset = company.workTimeOffset
      const workEndTimeInMinutes = workEndH * 60 + workEndTimeM - workTimeOffset

      const [ attendance ] = await strapi.entityService.findMany('api::attendance.attendance', {
        filters: {
          employee: employeeId,
          todayInNumber: dateInNumber
        }
      })
      let isEarlyOut = false
      const [ peTimeH, peTimeM ] = eventDateTime.format('HH:mm').split(':').map((item) => parseInt(item))
      const outTimeInMinutes = peTimeH * 60 + peTimeM
      if (outTimeInMinutes < workEndTimeInMinutes) {
        isEarlyOut = true
      }
      if (attendance) {
        await strapi.entityService.update('api::attendance.attendance', attendance.id, {
          data: {
            lastOut: eventLogObj.dateTime,
            workTime: attendance.firstIn ? eventDateTime.diff(moment(attendance.firstIn), 'hours') : 8,
            isEarlyOut: isEarlyOut,
            earlyOutStatus: isEarlyOut ? earlyOutAttendanceStatus.id : null,
            isAbsent: false,
            absenceStatus: null
          }
        })
      } else {
        await strapi.entityService.create('api::attendance.attendance', {
          data: {
            employee: employeeId,
            lastOut: eventLogObj.dateTime,
            isAbsent: false,
            absenceStatus: null,
            today: eventDateTime.format('YYYY-MM-DD'),
            todayInNumber: dateInNumber,
            company: company.id,
            isLateIn: false,
            isEarlyOut: isEarlyOut,
            earlyOutStatus: isEarlyOut ? earlyOutAttendanceStatus.id : null,
          }
        })
      }

      return await customSuccess(ctx, null)
    } catch (e) {
      console.log("error in listening logs hikvisionListeningOut", e)
      return await customError(ctx, e.message, 500)
    }
  },
  async isSubTypeValid(AccessControllerEvent) {
    return AccessControllerEvent.subEventType === 1 || AccessControllerEvent.subEventType === 75 || false
  },
  async attendances (ctx) {
    try {
      const dateQuery = ctx.request.query.date
      if (!dateQuery) return await customError(ctx, 'date query is required', 400)

      const currentDate = new Date(dateQuery)
      const aDayLaterNumber = new Date(dateQuery).setDate(currentDate.getDate() + 1)
      const aDayLater = new Date(aDayLaterNumber)
      const events = await strapi.entityService.findMany("api::event.event", { filters: { date: { $gte: currentDate, $lte: aDayLater }, ...ctx.request.query.filters }, fields: ["id", "date"], populate: { employee: { fields: ["id", "face", "first_name", "last_name"] }, hikvision: { fields: ["id", "type"] } } })
      const results = []
      const empEventsMap = new Map()
      let prevEvents = []

      for (const event of events) {
        prevEvents = empEventsMap.get(event.employee.id) || []
        prevEvents.push(event)
        empEventsMap.set(event.employee.id, prevEvents)
      }

      for (const [key, value] of empEventsMap) {
        results.push({
          employee: key,
          events: value
        })
      }

      return results
    } catch (err) {
      console.log("error in listening logs attendances", err)
      return await customError(ctx, err.message, 500)
    }
  }
}));
