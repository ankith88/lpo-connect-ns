/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 *
 * Author:               Ankith Ravindran
 * Created on:           Tue Apr 21 2026
 * Modified on:          Tue Apr 21 2026 12:21:29
 * SuiteScript Version:  2.0 
 * Description:          Suitelet used to send out the request to the franchisee owner of a new job request from the LPO. 
 *
 * Copyright (c) 2026 MailPlus Pty. Ltd.
 */


define([
    "N/ui/serverWidget",
    "N/email",
    "N/runtime",
    "N/search",
    "N/record",
    "N/http",
    "N/log",
    "N/redirect",
    "N/format", "N/https"
], function (ui, email, runtime, search, record, http, log, redirect, format, https) {
    var role = 0;
    var userId = 0;
    var zee = 0;

    function onRequest(context) {
        var baseURL = "https://system.na2.netsuite.com";
        if (runtime.EnvType == "SANDBOX") {
            baseURL = "https://system.sandbox.netsuite.com";
        }
        userId = runtime.getCurrentUser().id;
        role = runtime.getCurrentUser().role;

        var lpoLeadBDMAssigned = null;

        var date = new Date();
        var date_now = format.parse({
            value: date,
            type: format.Type.DATE,
        });
        var time_now = format.parse({
            value: date,
            type: format.Type.TIMEOFDAY,
        });

        var zeeName = null;
        var zeeEmail = null;
        var zeePhone = null;

        if (context.request.method === "GET") {

            log.debug({
                title: "context.request.parameters",
                details: context.request.parameters,
            });

            //{"compid":"1048144","lpo_id":"1974139","ns-at":"AAEJ7tMQM_E8dKF2qjDMy9ESy5q883g7xrb8uKwfgGOku62wheU","customer_id":"1993911","request_id":"mbq5xNZggC79fmYIOzNc","script":"2528","deploy":"1"}

            var customerInternalId = context.request.parameters.customer_id;
            var customerRecord = record.load({
                type: 'customer',
                id: customerInternalId
            });
            var business_name = customerRecord.getValue({
                fieldId: 'companyname'
            });
            var partnerID = customerRecord.getValue({
                fieldId: 'partner'
            });

            var customerPartnerRecord = record.load({
                type: 'partner',
                id: partnerID
            });

            var partnerPhone = customerPartnerRecord.getValue({
                fieldId: 'custentity2'
            });
            var partnerEmail = customerPartnerRecord.getValue({
                fieldId: 'email'
            });

            partnerPhone = partnerPhone.replace(/ /g, '');
            partnerPhone = partnerPhone.slice(1);
            partnerPhone = '+61' + partnerPhone;

            var jobRequestPageURL = 'https://mp-lpo-connect.web.app/request/' + context.request.parameters.request_id;

            var emailSubject = 'New Job Request for ' + business_name;
            var emailBody = 'You have received a new job request for ' + business_name + '. Please click the link below to view the details of the request and accept or reject it. \n\n' + jobRequestPageURL;

            // Send email to franchisee owner
            email.send({
                author: 112209,
                recipients: partnerEmail,
                subject: emailSubject,
                body: emailBody,
                bcc: ['dispatcher@mailplus.com.au', 'customerservice@mailplus.com.au'],
                relatedRecords: { entityId: customerInternalId }
            });

            //Send SMS
            var smsBody =
                'New Job Request for ' + business_name;
            smsBody += 'You have received a new job request for ' + business_name + '. Please click the link below to view the details of the request and accept or reject it. \n\n' + jobRequestPageURL;
            var apiResponse = https.post({
                url: "https://api.twilio.com/2010-04-01/Accounts/ACc4fb93dc175b8f9066ed80bf0caecdb7/Messages",
                body: {
                    Body: smsBody,
                    To: partnerPhone,
                    From: "+61488883115",
                },
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization:
                        "Basic QUNjNGZiOTNkYzE3NWI4ZjkwNjZlZDgwYmYwY2FlY2RiNzo3ZTFlZjEzNTM1ZjFmNzI1NmVjY2YwNzU4MWIwMWYxMg==",
                },
            });

            var returnObj = {
                "success": true,
                "message": "Message sent by the operator."
            }


            log.audit({
                title: 'Final Return',
                details: JSON.stringify(returnObj)
            })
            _sendJSResponse(context.request, context.response, returnObj);

        }
    }

    function _sendJSResponse(request, response, respObject) {
        // response.setContentType("JAVASCRIPT");
        response.setHeader('Access-Control-Allow-Origin', '*');
        var callbackFcn = request.jsoncallback || request.callback;
        if (callbackFcn) {
            response.writeLine({
                output: callbackFcn + "(" + JSON.stringify(respObject) + ");",
            });
        } else response.writeLine({ output: JSON.stringify(respObject) });
    }

    function getDateStoreNS() {
        var date = new Date();
        if (date.getHours() > 6) {
            date.setDate(date.getDate() + 1);
        }

        format.format({
            value: date,
            type: format.Type.DATE,
            timezone: format.Timezone.AUSTRALIA_SYDNEY
        })

        return date;
    }


    function getStateId(state) {
        var state_id;

        switch (state) {
            case "NSW":
                state_id = 1;
                break;
            case "QLD":
                state_id = 2;
                break;
            case "VIC":
                state_id = 3;
                break;
            case "SA":
                state_id = 4;
                break;
            case "TAS":
                state_id = 5;
                break;
            case "ACT":
                state_id = 6;
                break;
            case "WA":
                state_id = 7;
                break;
            case "NT":
                state_id = 8;
                break;
            case "NZ":
                state_id = 9;
                break;
        }

        return state_id;
    }

    function areDatesEqual(dateStr1, dateStr2) {
        // Expects both dates in "YYYY-MM-DD" format
        return dateStr1 === dateStr2;
    }


    /**
 * @description Function to check if a service exists in the service list.
 * @author Ankith Ravindran (AR)
 * @date 17/06/2025
 * @param {*} data
 * @param {*} service
 * @returns {*} 
 */
    function getServiceRate(serviceList, serviceName) {
        // serviceList: array of objects with 'name' and 'rate' properties
        // serviceName: string to check (case-insensitive)
        for (var i = 0; i < serviceList.length; i++) {
            if (serviceList[i].name == serviceName) {
                return { rate: serviceList[i].rate, id: serviceList[i].id };
            }
        }
        return null; // Not found
    }

    function pad(s) {
        return s < 10 ? "0" + s : s;
    }

    function isNullorEmpty(strVal) {
        return (
            strVal == null ||
            strVal == "" ||
            strVal == "null" ||
            strVal == undefined ||
            strVal == "undefined" ||
            strVal == "- None -" ||
            strVal == " "
        );
    }


    function arrayOfStringsToIntegers(arr) {
        var result = [];
        for (var i = 0; i < arr.length; i++) {
            var num = parseInt(arr[i], 10);
            if (!isNaN(num)) {
                result.push(num);
            }
        }
        return result;
    }

    function isArrayAlt(variable) {
        return Array.isArray ? Array.isArray(variable) : Object.prototype.toString.call(variable) === '[object Array]';
    }

    return {
        onRequest: onRequest,
    };
});
