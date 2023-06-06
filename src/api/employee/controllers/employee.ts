/**
 * employee controller
 */

import { factories } from '@strapi/strapi'
import {customError, customSuccess} from "../../../utils/app-response";
import {checkRequiredCredentials, isValidPhoneNumber} from "../../../utils/credentials";
import {Employee} from "../dto/employee";
import urlLib from 'urllib'
import * as fs from "fs";
import FormData from 'form-data'
import path from "path";
import { v4 as uuidv4 } from 'uuid';
import moment from "moment";
import is from "@sindresorhus/is";

export default factories.createCoreController('api::employee.employee', ({ strapi }): {} => ({
  async createEmployee(ctx) {
    try {
      const { image } = ctx.request.files
      const employeeData = ctx.request.body
      const { firstName, lastName, email, organization, phone, company, department, country, role } = ctx.request.body

      // const credentialsMap = new Map(
      //   [
      //     ['firstName', firstName],
      //     ['lastName', lastName],
      //     ['email', email],
      //     ['organization', organization],
      //     ['phone', phone],
      //     ['company', company],
      //     ['department', department],
      //     ['country', country],
      //   ]
      // )
      //
      // const checkRC = checkRequiredCredentials(credentialsMap)
      // if (!checkRC[0]) {
      //   return await customError(ctx, checkRC[1], 400)
      // }

      if (!image) {
        return await customError(ctx, 'image field must be provided', 400)
      }

      const imageType = image.type.split('/')[1]
      if (!(imageType === 'jpeg' || imageType === 'jpg' || imageType === 'png')) {
        return await customError(ctx, 'invalid image file type', 400)
      }

      const isValidPhone = isValidPhoneNumber(phone)
      if (!isValidPhone) {
        return await customError(ctx, 'phone number is not valid', 400)
      }

      const employee: Employee = await strapi.entityService.create('api::employee.employee', {
        data: employeeData
      });

      const [isLoadedLocally, fileName, filePath]: [boolean, string, string] = await this.uploadFaceLocal(image)
      if (!isLoadedLocally) {
        await strapi.entityService.delete('api::employee.employee', employee.id);
        return await customError(ctx, 'error while uploading face locally', 500)
      }

      const isHikvisionUserAdded: boolean = await this.addHikvisionEmployee(employee, fileName)
      if (!isHikvisionUserAdded) {
        await strapi.entityService.delete('api::employee.employee', employee.id);
        fs.unlinkSync(filePath);
        return await customError(ctx, 'error in adding hikvision user', 500)
      }

      await strapi.entityService.update('api::employee.employee', employee.id, {
        data: {
          face: fileName
        }
      });

      return await customSuccess(ctx, null)
    } catch (err) {
      strapi.log.error("error in function createEmployee, error: ", err)
      return await customError(ctx, 'internal server error', 500)
    }
  },
  async addHikvisionEmployee(employee: Employee, faceImageName: string) {
    const { id, firstName, lastName } = employee
    try {
      const hikvisions = await strapi.entityService.findMany('api::hikvision.hikvision');
      const currentYear = new Date().getFullYear()
      const hikvisionUserExp = +process.env.HIKVISION_USER_EXP // in years

      const reqBody = {
        UserInfo: {
          employeeNo: `emp${id}`,
          name: `${firstName}` + `${ lastName ? ' '+lastName : ''}`,
          userType: "normal",
          Valid: {
            enable: true,
            beginTime: `${ currentYear }-01-01T00:00:00`,
            endTime: `${ currentYear + hikvisionUserExp }-01-01T00:00:00`
          },
          RightPlan: [
            {doorNo: 1, planTemplateNo: "1"}
          ],
          doorRight: '1'
        }
      }

      for await (const hikvision of hikvisions) {
        const url = `http://${hikvision.ip}/ISAPI/AccessControl/UserInfo/Record?format=json`
        const isHikvisionEmployeeCreated: boolean = await this.createHikvisionEmployee(url, hikvision, reqBody)
        if (!isHikvisionEmployeeCreated) {
          return false
        }
        const isFaceUploadedHikvision: boolean = await this.uploadFaceHikvision(hikvision, faceImageName, employee.id)
        if (!isFaceUploadedHikvision) {
          await this.deleteHikvisionSingleUser(hikvision, employee.id)
          return false
        }
      }
      return true
    } catch (err) {
      strapi.log.error("error in function addHikvisionEmployee, error: ", err)
      return false
    }
  },
  async deleteHikvisionSingleUser(hikvision: any, employeeId: number) {
    try {
      const reqBody = {
        "UserInfoDelCond": {
          "EmployeeNoList": [
            {
              "employeeNo": `emp${employeeId}`
            }
          ]
        }
      }
      const url = `http://${hikvision.ip}/ISAPI/AccessControl/UserInfo/Delete?format=json`
      const response = await urlLib.request(url, {
        digestAuth: `admin:${hikvision.password}`,
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        data: reqBody
      })
      if (response.statusCode !== 200) {
        console.log(String(response.data))
        strapi.log.error("error in function deleteHikvisionSingleUser while deleting hikvision user, error: ", String(response.data))
      }
    return
    } catch (err) {
      strapi.log.error("error in function deleteHikvisionSingleUser, error: ", err)
      return
    }
  },
  async createHikvisionEmployee(url: string, hikvision: any, reqBody: any) {
    try {
      const response = await urlLib.request(url, {
        digestAuth: `admin:${hikvision.password}`,
        method: 'POST',
        data: reqBody,
        headers: {'Content-Type': 'application/json'}
      })
      if (response.statusCode !== 200) {
        strapi.log.error("error in function createHikvisionEmployee while creating hikvision user, error: ", String(response.data))
        return false
      }
      return true
    } catch (err) {
      strapi.log.error("error in function createHikvisionEmployee, error: ", err)
      return false
    }
  },
  async uploadFaceLocal(image: any) {
    try {
      const fileExt = path.extname(image.name)
      const data = fs.readFileSync(image.path);
      const fileName = uuidv4() + fileExt
      const newPath = path.join(strapi.dirs.static.public, "uploads", fileName);
      fs.writeFileSync(newPath, data);
      return [true, fileName, newPath]
    } catch (err) {
      strapi.log.error("error in function uploadFaceLocal, error: ", err)
      return [false, '', '']
    }
  },
  async uploadFaceHikvision(hikvision: any, fileName: string, employeeId: number) {
    try {
      const reqBody = new FormData()
      const serverIP = process.env.SERVER_IP
      const serverPort = process.env.SERVER_PORT

      reqBody.append('FaceDataRecord', JSON.stringify({
        "faceLibType": "blackFD",
        "FDID": "1",
        "FPID": `emp${employeeId}`,
        "faceURL": `http://${serverIP}:${serverPort}/uploads/${fileName}`,
      }))

      const url = `http://${hikvision.ip}/ISAPI/Intelligent/FDLib/FDSetUp?format=json`
      const response = await urlLib.request(url, {
        digestAuth: `admin:${hikvision.password}`,
        method: 'PUT',
        opaque: '',
        content: reqBody.getBuffer(),
        contentType: 'multipart/form-data; boundary=' + reqBody.getBoundary(),
        compressed: true
      })
      if (response.statusCode !== 200) {
        strapi.log.error("error in function uploadFaceHikvision while uploading, error: ", response)
        return false
      }
      return true
    } catch (err) {
      strapi.log.error("error in function uploadFaceHikvision, error: ", err)
      return false
    }
  },
  async deleteEmployee(ctx: any) {
    try {
      const { id } = ctx.params
      const employee = await strapi.entityService.findOne('api::employee.employee', id)
      if (!employee) {
        return await customError(ctx, 'employee not found', 404)
      }
      await this.deleteHikvisionsEmployee(employee.id)

      await strapi.entityService.delete('api::employee.employee', employee.id)

      fs.unlinkSync(path.join(strapi.dirs.static.public, "uploads", employee.face));
      return await customSuccess(ctx, null)
    } catch (err) {
      strapi.log.error("error in function deleteEmployee, error: ", err)
      return await customError(ctx, 'internal server error', 500)
    }
  },
  async deleteHikvisionsEmployee(employeeId: number) {
    try {
      const hikvisions = await strapi.entityService.findMany('api::hikvision.hikvision')
      for await (const hikvision of hikvisions) {
        await this.deleteHikvisionSingleUser(hikvision, employeeId)
      }
      return
    } catch (err) {
      strapi.log.error("error in function deleteHikvisionsEmployee, error: ", err)
      return
    }
  },
  async updateEmployee(ctx: any) {
    try {
      const { image } = ctx.request.files
      const employeeData = ctx.request.body
      const { id } = ctx.params
      const employee = await strapi.entityService.findOne('api::employee.employee', id)
      if (!employee) {
        return await customError(ctx, 'employee not found', 404)
      }

      let isLoadedLocally: boolean, fileName: string, filePath: string
      if (image) {
        [isLoadedLocally, fileName, filePath] = await this.uploadFaceLocal(image)
        if (!isLoadedLocally) {
          return await customError(ctx, 'error while uploading face locally', 500)
        }
      }

      const isHikvisionsUserUpdated: boolean = await this.updateHikvisionsEmployee(employee, fileName)
      if (!isHikvisionsUserUpdated) {
        return await customError(ctx, 'error in updating hikvision user', 500)
      }

      const employeeUpdate = await strapi.entityService.update('api::employee.employee', employee.id, {
        data: {
          ...employeeData,
          face: image ? fileName : employee.face
        }
      })
      if (!employeeUpdate) {
        return await customError(ctx, 'employee not updated', 500)
      }

      if (image) {
        fs.unlinkSync(path.join(strapi.dirs.static.public, "uploads", employee.face));
      }
      return await customSuccess(ctx, null)
    } catch (err) {
      strapi.log.error("error in function updateEmployee, error: ", err)
      return await customError(ctx, 'internal server error', 500)
    }
  },
  async updateHikvisionsEmployee(employee: { id: number, firstName: string, lastName: string}, faceImageName: string | null) {
    try {
      const hikvisions = await strapi.entityService.findMany('api::hikvision.hikvision');
      const currentYear = new Date().getFullYear()
      const hikvisionUserExp = +process.env.HIKVISION_USER_EXP // in years

      const reqBody = {
        UserInfo: {
          employeeNo: `emp${employee.id}`,
          name: `${employee.firstName}` + `${ employee.lastName ? ' '+employee.lastName : ''}`,
          userType: "normal",
          Valid: {
            enable: true,
            beginTime: `${ currentYear }-01-01T00:00:00`,
            endTime: `${ currentYear + hikvisionUserExp }-01-01T00:00:00`
          },
          RightPlan: [
            {doorNo: 1, planTemplateNo: "1"}
          ],
          doorRight: '1'
        }
      }

      for await (const hikvision of hikvisions) {
        const url = `http://${hikvision.ip}/ISAPI/AccessControl/UserInfo/Modify?format=json`
        const isHikvisionEmployeeUpdated: boolean = await this.updateHikvisionEmployee(url, hikvision, reqBody)
        if (!isHikvisionEmployeeUpdated) {
          return false
        }
        if (faceImageName) {
          const isFaceUploadedHikvision: boolean = await this.uploadFaceHikvision(hikvision, faceImageName, employee.id)
          if (!isFaceUploadedHikvision) {
            return false
          }
        }
      }
      return true
    } catch (err) {
      strapi.log.error("error in function updateHikvisionEmployee, error: ", err)
      return false
    }
  },
  async updateHikvisionEmployee(url: string, hikvision: any, reqBody: any) {
    try {
      const response = await urlLib.request(url, {
        digestAuth: `admin:${hikvision.password}`,
        method: 'PUT',
        data: reqBody,
        headers: {'Content-Type': 'application/json'}
      })
      if (response.statusCode !== 200) {
        strapi.log.error("error in function updateHikvisionEmployee while updating, error: ", response)
        return false
      }
      return true
    } catch (err) {
      strapi.log.error("error in function updateHikvisionEmployee, error: ", err)
      return false
    }
  },
  async makeAdminEmployee(ctx: any) {
    try {
      const { id } = ctx.params
      const { password, username } = ctx.request.body

      if (!password) {
        return await customError(ctx, 'password is required', 400)
      }
      if (!username) {
        return await customError(ctx, 'username is required', 400)
      }
      if (password.length < 6) {
        return await customError(ctx, 'password must be at least 6 characters', 400)
      }
      const employee = await strapi.entityService.findOne('api::employee.employee', id)
      if (!employee) {
        return await customError(ctx, 'employee not found', 404)
      }

      const [ user ] = await strapi.entityService.findMany('plugin::users-permissions.user', {
        filters: {
          username: username
        }
      })

      if (user) {
        return await customError(ctx, 'username already exists', 409)
      }

      const [ adminRole ] = await strapi.entityService.findMany('plugin::users-permissions.role', {
        filters: {
          name: 'Admin'
        }
      })

      const newUser = await strapi.entityService.create('plugin::users-permissions.user', {
        data: {
          username: username,
          email: employee.email,
          provider: 'local',
          password: password,
          confirmed: true,
          blocked: false,
          role: adminRole.id
        }
      })

      await strapi.entityService.update('api::employee.employee', employee.id, {
        data: {
          user: newUser.id,
          isAdmin: true
        }
      })

      return await customSuccess(ctx, null)
    } catch (err) {
      strapi.log.error("error in function makeAdminEmployee, error: ", err)
      return await customError(ctx, 'internal server error', 500)
    }
  },
  async makeNotAdminEmployee(ctx: any) {
    try {
      const { id } = ctx.params

      const [ employee ] = await strapi.entityService.findMany('api::employee.employee', {
        filters: {
          id: id
        },
        populate: ['user']
      })
      if (!employee) {
        return await customError(ctx, 'employee not found', 404)
      }

      await strapi.entityService.delete('plugin::users-permissions.user', employee.user.id)

      await strapi.entityService.update('api::employee.employee', employee.id, {
        data: {
          isAdmin: false
        }
      })

      return await customSuccess(ctx, null)
    } catch (err) {
      strapi.log.error("error in function makeNotAdminEmployee, error: ", err)
      return await customError(ctx, 'internal server error', 500)
    }
  },
  async meEmployee(ctx: any) {
    const { id, username, email, confirmed, blocked, role } = ctx.state.user

    const [ user ] = await strapi.entityService.findMany('plugin::users-permissions.user', {
      filters: {
        id: id
      },
      populate: ['company']
    })
    return await customSuccess(ctx, {
      id,
      username,
      email,
      confirmed,
      blocked,
      role,
      company: user.company
    })
  },
  async dashboardStats (ctx) {
    try {
      const employees = await strapi.db.query('api::employee.employee').findWithCount({})
      const computers = await strapi.db.query('api::computer.computer').findWithCount({})
      const incidents = await strapi.db.query('api::incident.incident').findWithCount({})
      return {
        employees,
        computers,
        incidents
      }
    } catch (e) {
      return await customError(ctx, e.message, 400)
    }
  },
  async collectAllEmployees(ctx) {
    try {
      const employees = fs.readFileSync('./employees.json', 'utf8')

      const parsedEmployees = JSON.parse(employees)

      const publicPath = path.join(strapi.dirs.static.public, "uploads")

      for (const parsedEmployee of parsedEmployees) {
        let faceImageName, faceImageArr, ext, newFaceImageName
        if (parsedEmployee.face) {
          faceImageName = uuidv4()
          faceImageArr = parsedEmployee.face.split('.')
          ext = faceImageArr[faceImageArr.length - 1]
          newFaceImageName = `${faceImageName}.${ext}`
        }

        await strapi.entityService.create('api::employee.employee', {
          data: {
            ...parsedEmployee,
            face: parsedEmployee.face ? newFaceImageName : null,
            company: 2
          }
        })

        if (parsedEmployee.face) {
          console.log(path.join(publicPath, newFaceImageName))
          const fileName = parsedEmployee.face.split('/')[2]
          fs.renameSync(path.join(publicPath, fileName), path.join(publicPath, newFaceImageName))
        }
      }


      return await customSuccess(ctx, null)
    } catch (e) {
      console.log(e)
      return await customError(ctx, 'internal error', 500)
    }
  },
  async collectAllEvents(ctx) {
    try {
      const events = fs.readFileSync('./events.json', 'utf8')

      const parsedEvents = JSON.parse(events)

      // const publicPath = path.join(strapi.dirs.static.public, "uploads")

      const [ company ] = await strapi.entityService.findMany('api::company.company', {})
      const attendanceStatuses = await strapi.entityService.findMany('api::attendance-status.attendance-status', {
        filters: {
          company: company.id
        }
      })

      // const mainAttendanceStatus = attendanceStatuses.find((status) => status.isMain)
      const lateInAttendanceStatus = attendanceStatuses.find((status) => status.key === 'lateIn')
      const earlyOutAttendanceStatus = attendanceStatuses.find((status) => status.key === 'earlyOut')

      const [ workStartH, workStarM ] = moment(company.workStartTime).format('HH:mm').split(':').map((time) => parseInt(time))
      const [ workEndH, workEndTimeM ] = moment(company.workEndTime).format('HH:mm').split(':').map((time) => parseInt(time))

      const workTimeOffset = company.workTimeOffset
      const workStartTimeInMinutes = workStartH * 60 + workStarM + workTimeOffset
      const workEndTimeInMinutes = workEndH * 60 + workEndTimeM - workTimeOffset

      let dateReminder: string | null = null
      let year: number, month: number, day: number
      let peDateToNumber: number

      for (const parsedEvent of parsedEvents) {
        await strapi.entityService.create('api::event.event', {
          data: {
            name: parsedEvent.name,
            currentVerifyMode: parsedEvent.currentVerifyMode,
            mask: parsedEvent.mask,
            pictureURL: parsedEvent.pictureURL,
            major: parsedEvent.major,
            subType: parsedEvent.minor,
            hash: parsedEvent.hash,
            employee: parsedEvent.employee?.id ?? null,
            hikvision: parsedEvent.hikvision?.id === 1 ? 4 : 3,
            date: parsedEvent.time,
          }
        })

        if (parsedEvent.time) {
          const [peDate, peTime] = parsedEvent.time.split('T')
          if (dateReminder !== peDate) {
            console.log('dateReminder', dateReminder)
            dateReminder = peDate
            const splitDate = peDate.split('-').map((item) => parseInt(item))
            year = splitDate[0]
            month = splitDate[1]
            day = splitDate[2]

            peDateToNumber = year + (month * 2023 ) + day
          }


          if (!parsedEvent.employee) {
            console.log(parsedEvent)
            continue
          }
          const [ attendance ] = await strapi.entityService.findMany('api::attendance.attendance', {
            filters: {
              employee: parsedEvent.employee.id,
              todayInNumber: peDateToNumber
            }
          })

          if (attendance) {
            let isLateIn = false
            let isEarlyOut = false

            if (parsedEvent.hikvision.type === 'in') {
              const [ peTimeH, peTimeM ] = moment(parsedEvent.time).format('HH:mm').split(':').map((item) => parseInt(item))
              const inTimeInMinutes = peTimeH * 60 + peTimeM
              if (inTimeInMinutes > workStartTimeInMinutes) {
                isLateIn = true
              }
              if (!attendance.firstIn) {
                await strapi.entityService.update('api::attendance.attendance', attendance.id, {
                  data: {
                    firstIn: parsedEvent.time,
                    isLateIn: isLateIn,
                    lateInStatus: isLateIn ? lateInAttendanceStatus.id : null,
                  }
                })
              }
            }

            if (parsedEvent.hikvision.type === 'out') {
              const [ peTimeH, peTimeM ] = moment(parsedEvent.time).format('HH:mm').split(':').map((item) => parseInt(item))
              const outTimeInMinutes = peTimeH * 60 + peTimeM
              if (outTimeInMinutes < workEndTimeInMinutes) {
                isEarlyOut = true
              }
              await strapi.entityService.update('api::attendance.attendance', attendance.id, {
                data: {
                  lastOut: parsedEvent.time,
                  workTime: attendance.firstIn ? moment(parsedEvent.time).diff(moment(attendance.firstIn), 'hours') : 8,
                  isEarlyOut: isEarlyOut,
                  earlyOutStatus: isEarlyOut ? earlyOutAttendanceStatus.id : null,
                }
              })
            }
          } else {
            let isLateIn = false
            let isEarlyOut = false
            if (parsedEvent.hikvision.type === 'in') {
              const [ peTimeH, peTimeM ] = moment(parsedEvent.time).format('HH:mm').split(':').map((item) => parseInt(item))
              const inTimeInMinutes = peTimeH * 60 + peTimeM
              if (inTimeInMinutes > workStartTimeInMinutes) {
                isLateIn = true
              }
            }
            if (parsedEvent.hikvision.type === 'out') {
              const [ peTimeH, peTimeM ] = moment(parsedEvent.time).format('HH:mm').split(':').map((item) => parseInt(item))
              const outTimeInMinutes = peTimeH * 60 + peTimeM
              if (outTimeInMinutes < workEndTimeInMinutes) {
                isEarlyOut = true
              }
            }
            await strapi.entityService.create('api::attendance.attendance', {
              data: {
                employee: parsedEvent.employee.id,
                firstIn: parsedEvent.hikvision.type === 'in' ? parsedEvent.time : null,
                lastOut: parsedEvent.hikvision.type === 'out' ? parsedEvent.time : null,
                isAbsent: false,
                absenceStatus: null,
                today: peDate,
                todayInNumber: peDateToNumber,
                company: company.id,
                isLateIn: isLateIn,
                isEarlyOut: isEarlyOut,
                lateInStatus: isLateIn ? lateInAttendanceStatus.id : null,
                earlyOutStatus: isEarlyOut ? earlyOutAttendanceStatus.id : null,
              }
            })
          }
        }
      }
      return await customSuccess(ctx, null)
    } catch (e) {
      console.log(e)
      return await customError(ctx, 'internal error', 500)
    }
  },
  async createDeleteFakeEmployees(ctx) {
    try {
      for (let i = 0; i < 273; i++) {
        const employee = await strapi.entityService.create('api::employee.employee', {
          data: {
            company: 2
          }
        })
        await strapi.entityService.delete('api::employee.employee', employee.id)
      }
      return await customSuccess(ctx, null)
    } catch (err) {
      console.log('error in function createDeleteFakeEmployees, error:', err)
      return await customError(ctx, 'internal error', 500)
    }
  },
  async deleteTestEntities(ctx) {
    try {
      await strapi.db.query("api::attendance.attendance").deleteMany({
        where: {
          id: {
            $ne: 0,
          },
        },
      });
      await strapi.db.query("api::event.event").deleteMany({
        where: {
          id: {
            $ne: 0,
          },
        },
      });
      return await customSuccess(ctx, null)
    } catch (err) {
      console.log('error in function deleteTestEntities, error:', err)
      return await customError(ctx, 'internal error:', 500)
    }
  }
}));
