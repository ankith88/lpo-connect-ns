/** 
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 *
 * Author:               Ankith Ravindran
 * Created on:           Tue Apr 28 2026
 * Modified on:          Tue Apr 28 2026 11:05:21
 * SuiteScript Version:  2.0
 * Description:           Suitelet script to handle stop completion by operator and update the status in Firebase, as well as send email notification to LPO.
 *
 * Copyright (c) 2026 MailPlus Pty. Ltd.
 */


define(['N/ui/serverWidget', 'N/email', 'N/runtime', 'N/search', 'N/record',
    'N/http', 'N/log', 'N/redirect', 'N/https', 'N/email', 'N/url'
],
    function (ui, email, runtime, search, record, http, log, redirect, https, email, url) {
        var role = 0;
        var userId = 0;
        var zee = 0;

        var localMileJobID = null;
        var lpoHubJobID = null;
        var localMileJobCustomerInternalID = null;

        function onRequest(context) {
            var baseURL = 'https://system.na2.netsuite.com';
            if (runtime.EnvType == "SANDBOX") {
                baseURL = 'https://system.sandbox.netsuite.com';
            }
            userId = runtime.getCurrentUser().id;

            role = runtime.getCurrentUser().role;

            if (context.request.method === 'GET') {
                log.debug({
                    title: 'context.request.parameters',
                    details: context.request.parameters
                });

                var jobId = context.request.parameters.jobid;
                var jobgroupId = context.request.parameters.jobgroupid;
                var operatorId = context.request.parameters.operatorid;
                var jobStatus = context.request.parameters.jobstatus;

                //GENERATE THE ACCESS TOKEN USING LOGIN CREDENTIALS
                var tokenBody = '{"email":"ankith.ravindran@mailplus.com.au","password":"123456aA","returnSecureToken":true}'

                var apiHeaders = {};
                apiHeaders["Content-Type"] = "application/json";

                var responseAccessToken = https.request({
                    method: https.Method.POST,
                    url: 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDklo95QYbj4PGZeKAqRBBzCfFKc9CFoXs',
                    headers: apiHeaders,
                    body: tokenBody
                });

                log.debug({
                    title: 'Firebase Access Token Response',
                    details: responseAccessToken.body
                });

                var responseAccessTokenObj = JSON.parse(responseAccessToken.body);

                var idToken = responseAccessTokenObj.idToken;
                // idToken = 'ya29.a0ATi6K2uGzEXpA07xm1-OI2-D9r41aWvNVY41S-Vnc4HXGKC6h4sbss8KmNWJIr_4Kb3XBMIjS8HNxwCTfHwQDJl5aupTem3HWohun97glrBvdUATOQcHkRTHyruqFZ1tYV5-lO6xv5o5k_P-MmmQ-xnLKA0FFuA7eaAvaIWledMhISrjZslqYeOca8O6kfBe7nl2wYcaCgYKAawSARASFQHGX2Mik7hiK6ZgPGfhVO_d8ecJ-A0206'
                var refreshToken = responseAccessTokenObj.refreshToken;

                log.debug({
                    title: 'jobId',
                    details: jobId
                });
                log.debug({
                    title: 'jobgroupId',
                    details: jobgroupId
                });
                log.debug({
                    title: 'operatorId',
                    details: operatorId
                });
                log.debug({
                    title: 'jobStatus',
                    details: jobStatus
                });

                if (!isNullorEmpty(jobId) && !isNullorEmpty(jobgroupId) && !isNullorEmpty(operatorId) && !isNullorEmpty(jobStatus)) {
                    //Get Franchisee Details from the Operator ID
                    var operatorRecord = record.load({
                        type: "customrecord_operator",
                        id: operatorId
                    });
                    var zeeID = operatorRecord.getValue({
                        fieldId: "custrecord_operator_franchisee"
                    });

                    //Load the App Job Group and get the Customer ID
                    var app_job_group_rec = record.load({
                        type: "customrecord_jobgroup",
                        id: jobgroupId
                    });
                    var appJobGroupServiceInternalID = app_job_group_rec.getValue({
                        fieldId: "custrecord_jobgroup_service"
                    });
                    var appJobGroupServiceText = app_job_group_rec.getText({
                        fieldId: "custrecord_jobgroup_service"
                    });
                    var appJobGroupCustomerInternalID = app_job_group_rec.getValue({
                        fieldId: "custrecord_jobgroup_customer"
                    });
                    localMileJobCustomerInternalID = appJobGroupCustomerInternalID;
                    var appJobGroupOperatosRejected = app_job_group_rec.getValue({
                        fieldId: "custrecord_job_ops_rejected"
                    });
                    localMileJobID = app_job_group_rec.getValue({
                        fieldId: "custrecord_jobgroup_prem_id"
                    });
                    lpoHubJobID = app_job_group_rec.getValue({
                        fieldId: "custrecord_lpo_hub_job_id"
                    });

                    //Load the Lead Record to get the Parent ID and Company Name
                    var leadRecord = record.load({
                        type: 'customer',
                        id: appJobGroupCustomerInternalID
                    })
                    var leadCompanyName = leadRecord.getValue({
                        fieldId: "companyname"
                    });
                    var leadParentInternalID = leadRecord.getValue({
                        fieldId: "parent"
                    });

                    log.debug({
                        title: 'Parent Internal ID',
                        details: leadParentInternalID
                    });


                    log.debug({
                        title: 'LPO Parent Account Internal ID',
                        details: leadParentInternalID
                    });


                    //Load the LPO Parent Account
                    var lpoParentAccountRecord = record.load({
                        type: 'customer',
                        id: leadParentInternalID
                    });
                    var lpoParentLinkedZees = lpoParentAccountRecord.getValue({
                        fieldId: "custentity_lpo_linked_franchisees"
                    });
                    var lpoParentEmail = lpoParentAccountRecord.getValue({
                        fieldId: "custentity_email_service"
                    });

                    log.debug({
                        title: 'LPO Parent Linked Franchisees',
                        details: lpoParentLinkedZees
                    });
                    log.debug({
                        title: 'Check if Variable is an array',
                        details: isArrayAlt(lpoParentLinkedZees)
                    });

                    //Load the App Job Record and update the customer & franchisee details
                    var appJobRecord = record.load({
                        type: 'customrecord_job',
                        id: jobId
                    });
                    appJobRecord.setValue({
                        fieldId: "custrecord_job_status",
                        value: jobStatus
                    });
                    var serviceLeg = appJobRecord.getValue({
                        fieldId: "custrecord_job_service_leg"
                    });

                    var appJobRecordId = appJobRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });



                    if (!isNullorEmpty(lpoHubJobID)) {

                        //If Completed
                        var updateJobCollectionJSON = {
                            "data": {
                                "jobId": "" + jobgroupId + "",
                                "collectionName": "jobs",
                                "stops": [
                                    { "index": parseInt(serviceLeg), "status": "completed" }
                                ]
                            }
                        }


                        var firebaseUpdateURL =
                            'https://updatejobstatus-us-central1-mp-lpo-connect.cloudfunctions.net/updateJobStatus';
                        var apiHeaders = {};
                        apiHeaders["Content-Type"] = "application/json";
                        apiHeaders["Accept"] = '*/*';
                        apiHeaders["Authorization"] = "Bearer " + idToken;

                        var response = https.request({
                            method: https.Method.POST,
                            url: firebaseUpdateURL,
                            body: JSON.stringify(updateJobCollectionJSON),
                            headers: apiHeaders
                        });

                        var myresponse_body = response.body;
                        var myresponse_code = response.code;


                        log.debug({
                            title: 'myresponse_body',
                            details: myresponse_body
                        });

                        log.debug({
                            title: 'myresponse_code',
                            details: myresponse_code
                        });

                        //Send Email to LPO when stop has been completed by the operator for the day.
                        if (!isNullorEmpty(lpoParentEmail)) {
                            var emailSubject = 'Stop Completed by Operator';
                            var emailBody = 'Dear LPO,<br><br>';
                            emailBody += 'We would like to inform you that the stop with ID ' + lpoHubJobID + ' has been completed by the operator for the day.<br><br>';
                            emailBody += 'Best regards,<br>';
                            emailBody += 'MailPlus Team';

                            email.send({
                                author: 112209, //MailPlus Team
                                body: emailBody,
                                recipients: [lpoParentEmail],
                                cc: ['michael.mcdaid@mailplus.com.au', 'kerry.oneill@mailplus.com.au', 'mailplusit@mailplus.com.au'],
                                subject: emailSubject,
                                relatedRecords: { entityId: leadParentInternalID },
                            })
                        }
                    }

                } else {
                    log.debug({
                        title: 'result',
                        details: "Invalid input parameters."
                    });
                    var returnObj = {
                        success: false,
                        message: "Invalid input parameters.",
                        result: 'invalid',
                    };
                }

                _sendJSResponse(context.request, context.response, returnObj);
            } else {

            }
        }

        function removeDuplicates(arr) {
            var unique = [];
            for (var i = 0; i < arr.length; i++) {
                if (unique.indexOf(arr[i]) === -1) {
                    unique.push(arr[i]);
                }
            }
            return unique;
        }

        function isArrayAlt(variable) {
            return Array.isArray ? Array.isArray(variable) : Object.prototype.toString.call(variable) === '[object Array]';
        }

        function arraysMatch(arr1, arr2) {
            if (!arr1 || !arr2 || arr1.length !== arr2.length) return false;

            // Convert all values to strings for consistent comparison
            var arr1Sorted = arr1.map(String).sort();
            var arr2Sorted = arr2.map(String).sort();

            for (var i = 0; i < arr1Sorted.length; i++) {
                if (arr1Sorted[i] !== arr2Sorted[i]) {
                    return false;
                }
            }
            return true;
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

        function _sendJSResponse(request, response, respObject) {
            // response.setContentType("JAVASCRIPT");
            // response.setHeader('Access-Control-Allow-Origin', '*');
            var callbackFcn = request.jsoncallback || request.callback;
            if (callbackFcn) {
                response.writeLine({
                    output: callbackFcn + "(" + JSON.stringify(respObject) + ");",
                });
            } else response.writeLine({ output: JSON.stringify(respObject) });
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

        // Function to get current date and time in "dd/mm/yyyy HH:MM" format
        function getCurrentDateTime() {
            var now = new Date();
            now.setHours(now.getUTCHours() + 11);
            var day = customPadStart(now.getDate().toString(), 2, "0");
            var month = customPadStart((now.getMonth() + 1).toString(), 2, "0"); // Months are zero-based
            var year = now.getFullYear();
            var hours = customPadStart(now.getUTCHours().toString(), 2, "0");
            var minutes = customPadStart(now.getUTCMinutes().toString(), 2, "0");
            return day + "/" + month + "/" + year + " " + hours + ":" + minutes;
        }

        /**
         * @description Pads the current string with another string (multiple times, if needed) until the resulting string reaches the given length. The padding is applied from the start (left) of the current string.
         * @param {string} str - The original string to pad.
         * @param {number} targetLength - The length of the resulting string once the current string has been padded.
         * @param {string} padString - The string to pad the current string with. Defaults to a space if not provided.
         * @returns {string} The padded string.
         */
        function customPadStart(str, targetLength, padString) {
            // Convert the input to a string
            str = String(str);

            // If the target length is less than or equal to the string's length, return the original string
            if (str.length >= targetLength) {
                return str;
            }

            // Calculate the length of the padding needed
            var paddingLength = targetLength - str.length;

            // Repeat the padString enough times to cover the padding length
            var repeatedPadString = customRepeat(
                padString,
                Math.ceil(paddingLength / padString.length)
            );

            // Slice the repeated padString to the exact padding length needed and concatenate with the original string
            return repeatedPadString.slice(0, paddingLength) + str;
        }
        /**
         * @description Repeats the given string a specified number of times.
         * @param {string} str - The string to repeat.
         * @param {number} count - The number of times to repeat the string.
         * @returns {string} The repeated string.
         */
        function customRepeat(str, count) {
            // Convert the input to a string
            str = String(str);

            // If the count is 0 or less, return an empty string
            if (count <= 0) {
                return "";
            }

            // Initialize the result string
            var result = "";

            // Repeat the string by concatenating it to the result
            for (var i = 0; i < count; i++) {
                result += str;
            }

            return result;
        }

        function getDateToday() {
            var date = new Date();
            format.format({
                value: date,
                type: format.Type.DATE,
                timezone: format.Timezone.AUSTRALIA_SYDNEY,
            });

            return date;
        }

        function getDateStoreNS() {
            var date = new Date();
            if (date.getHours() > 6) {
                date.setDate(date.getDate() + 1);
            }

            format.format({
                value: date,
                type: format.Type.DATE,
                timezone: format.Timezone.AUSTRALIA_SYDNEY,
            });

            return date;
        }

        return {
            onRequest: onRequest,
        };
    });
