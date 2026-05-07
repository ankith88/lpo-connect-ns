/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * Author:               Ankith Ravindran
 * Created on:           Fri Apr 17 2026
 * Modified on:          Fri Apr 17 2026 09:19:56
 * SuiteScript Version:  2.0
 * Description:          Schedule Script to sync Parent LPO Account details to Firebase and assign dialers and sales reps to the leads in Firebase based on certain criteria. The script also syncs the primary contact details and the most recent user note for the lead to Firebase. The script is designed to process leads in batches of 300 and reschedule itself if there are more leads to process.
 *
 * Copyright (c) 2026 MailPlus Pty. Ltd.
 */

define([
	"N/task",
	"N/email",
	"N/runtime",
	"N/search",
	"N/record",
	"N/format",
	"N/https"
], function (task, email, runtime, search, record, format, https) {
	var main_JSON = "";
	var lpoName = "";
	var lpoContactFName = null;
	var lpoContactLName = null;
	var lpoContactEmail = null;
	var lpoContactPhone = null;

	function execute(context) {
		//GENERATE THE ACCESS TOKEN USING LOGIN CREDENTIALS
		var tokenBody =
			'{"email":"ankith.ravindran@mailplus.com.au","password":"123456aA","returnSecureToken":true}';

		var apiHeaders = {};
		apiHeaders["Content-Type"] = "application/json";

		var responseAccessToken = https.request({
			method: https.Method.POST,
			url: "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDklo95QYbj4PGZeKAqRBBzCfFKc9CFoXs",
			headers: apiHeaders,
			body: tokenBody
		});

		log.debug({
			title: "Firebase Access Token Response",
			details: responseAccessToken.body
		});

		var responseAccessTokenObj = JSON.parse(responseAccessToken.body);

		var idToken = responseAccessTokenObj.idToken;
		// idToken = 'ya29.a0ATi6K2uGzEXpA07xm1-OI2-D9r41aWvNVY41S-Vnc4HXGKC6h4sbss8KmNWJIr_4Kb3XBMIjS8HNxwCTfHwQDJl5aupTem3HWohun97glrBvdUATOQcHkRTHyruqFZ1tYV5-lO6xv5o5k_P-MmmQ-xnLKA0FFuA7eaAvaIWledMhISrjZslqYeOca8O6kfBe7nl2wYcaCgYKAawSARASFQHGX2Mik7hiK6ZgPGfhVO_d8ecJ-A0206'
		var refreshToken = responseAccessTokenObj.refreshToken;

		//Search: LPO Lead Profiles - To be Synced with Firbase
		var lpoLeadProfileSearch = search.load({
			type: "customrecord_lpo_lead_form",
			id: "customsearch_lpo_profiles_sync_firebase"
		});
		var resultSetLPOLeadProfile = lpoLeadProfileSearch.run();
		resultSetLPOLeadProfile.each(function (searchResult) {
			var linkedParentCustomerInternalID = searchResult.getValue({
				name: "internalid",
				join: "CUSTRECORD_LPO_LEAD_CUSTOMER"
			});
			var linkedParentCustomerName = searchResult.getValue({
				name: "companyname",
				join: "CUSTRECORD_LPO_LEAD_CUSTOMER"
			});
			var lpoDefaultPassword = searchResult.getValue({
				name: "custrecord_lpo_default_password"
			});

			log.debug({
				title: "lpoDefaultPassword",
				details: lpoDefaultPassword
			});

			log.debug({
				title: "linkedParentCustomerInternalID",
				details: linkedParentCustomerInternalID
			});
			log.debug({
				title: "linkedParentCustomerName",
				details: linkedParentCustomerName
			});

			var leadRecord = record.load({
				type: "customer",
				id: parseInt(linkedParentCustomerInternalID)
			});

			//Get Contact Details
			// NetSuite Search: SALESP - Contacts
			var searched_contacts = search.load({
				id: "customsearch_salesp_contacts",
				type: "contact"
			});

			searched_contacts.filters.push(
				search.createFilter({
					name: "internalid",
					join: "CUSTOMER",
					operator: search.Operator.ANYOF,
					values: parseInt(linkedParentCustomerInternalID)
				})
			);
			resultSetContacts = searched_contacts.run();

			var serviceContactResult = resultSetContacts.getRange({
				start: 0,
				end: 1
			});

			var primaryContactInternalID = "";
			var customerContactFirstName = "";
			var customerContactLastName = "";
			var customerContactEmail = "";
			var customerContactPhone = "";
			if (serviceContactResult.length == 1) {
				primaryContactInternalID = serviceContactResult[0].getValue({
					name: "internalid"
				});
				lpoContactFName = serviceContactResult[0].getValue({
					name: "firstname"
				});
				lpoContactLName = serviceContactResult[0].getValue({
					name: "lastname"
				});
				lpoContactEmail = serviceContactResult[0].getValue({
					name: "email"
				});
				lpoContactPhone = serviceContactResult[0].getValue({
					name: "phone"
				});
			}

			//Get Contact Details
			if (primaryContactInternalID) {
				

				var headerObj = {
					name: "Content-Type",
					value: "application/json"
				};
				var responseUserAuth = https.post({
					url: "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyDklo95QYbj4PGZeKAqRBBzCfFKc9CFoXs",
					body: {
						email: lpoContactEmail,
						password: lpoDefaultPassword,
						returnSecureToken: true
					},
					headers: headerObj
				});

				//{"type":"http.ClientResponse","code":200,"headers":{"Alt-Svc":"h3=\":443\"; ma=2592000,h3-29=\":443\"; ma=2592000","alt-svc":"h3=\":443\"; ma=2592000,h3-29=\":443\"; ma=2592000","Cache-Control":"no-cache, no-store, max-age=0, must-revalidate","cache-control":"no-cache, no-store, max-age=0, must-revalidate","Content-Type":"application/json; charset=UTF-8","content-type":"application/json; charset=UTF-8","Date":"Fri, 17 Apr 2026 04:26:08 GMT","date":"Fri, 17 Apr 2026 04:26:08 GMT","Expires":"Mon, 01 Jan 1990 00:00:00 GMT","expires":"Mon, 01 Jan 1990 00:00:00 GMT","Pragma":"no-cache","pragma":"no-cache","Server":"ESF","server":"ESF","Transfer-Encoding":"chunked","transfer-encoding":"chunked","Vary":"Origin","vary":"Origin","Via":"1.1 mono003.prod-mel-ap3.core.ns.internal","via":"1.1 mono003.prod-mel-ap3.core.ns.internal","X-Content-Type-Options":"nosniff","x-content-type-options":"nosniff","X-Frame-Options":"SAMEORIGIN","x-frame-options":"SAMEORIGIN","X-XSS-Protection":"0","x-xss-protection":"0","X-Xss-Protection":"0"},"body":"{\n \"kind\": \"identitytoolkit#SignupNewUserResponse\",\n \"idToken\": \"eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwZmM5YzU0YjhiMjQyMWZmMTgyOTgxNTQyZmQ0NjRlOWJlYzM1NDUiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vbXAtbHBvLWNvbm5lY3QiLCJhdWQiOiJtcC1scG8tY29ubmVjdCIsImF1dGhfdGltZSI6MTc3NjM5OTk2OCwidXNlcl9pZCI6Iml4d3cyQ2huZ3lkQkQ4aXdNTEp1TzRhT3JBOTIiLCJzdWIiOiJpeHd3MkNobmd5ZEJEOGl3TUxKdU80YU9yQTkyIiwiaWF0IjoxNzc2Mzk5OTY4LCJleHAiOjE3NzY0MDM1NjgsImVtYWlsIjoiYW5raXRocmF2aW5kcmFuM0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsiYW5raXRocmF2aW5kcmFuM0BnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.mfVlY9ugrabC2BfThli_QndJsOB9iMJEkS65PkTlhXqOWOqM8b0nf8lWOSS8BIWUCMGF5ePUp7yOm3MDW7__DmT61r5DZjgDMgILpv4GDc744Pc982-fGZot4NMv4ieWekUnV9ksxcoCrCaDQU5OdINdV45Sr1lHUW1NXJSbEJmmNeJFKDKzv2z79zh0zzJLA3zayh4AiHGj-dETgF1DA0wXpkJ7oWDwgfNVZ0GcVfEhl6lygNTaF_ySJpuCCP0-vaaHJlU-JnpqSzjDezXvszL_Krw5xHRjp2nUhMxRnIRCWI5lqM5AXse0t_JTAlOiCXtvrw23LzI3h4WM-HzNPQ\",\n \"email\": \"ankithravindran3@gmail.com\",\n \"refreshToken\": \"AMf-vBxkXbY2JGFwI6LrWku9FhLq1W8kNPG_EMdqH5wKvXrXAumMhYcOrqIjP7lNcFpt-7kH68B4GYi4n7-K-J87QdOJFUdJNxskQJzS2d73ac3ZdlsxGandScSerOt9qxwSq4O1jvCpvGU1iYpTTzWAIHdWQFUuhZm0RMWi7RW0CWzfPX-Iww-NNUlL4hiuK8DBMmEpYxxyeUtMkpFBtjjNS97fhRIsvw\",\n \"expiresIn\": \"3600\",\n \"localId\": \"ixww2ChngydBD8iwMLJuO4aOrA92\"\n}\n"}
				log.debug({
					title: "responseUserAuth",
					details: responseUserAuth
				});
				log.debug({
					title: "responseUserAuth.body.localId",
					details: responseUserAuth.body.localId
				});

				var authID = responseUserAuth.body.localId;

				var lpoContactDetails = '{"fields": {';
				lpoContactDetails +=
					'"first_name": {"stringValue": "' + lpoContactFName + '"},';
				lpoContactDetails +=
					'"last_name": {"stringValue": "' + lpoContactLName + '"},';
				lpoContactDetails +=
					'"email": {"stringValue": "' + lpoContactEmail + '"},';
				lpoContactDetails +=
					'"phone": {"stringValue": "' + lpoContactPhone + '"},';
				lpoContactDetails +=
					'"lpo_id": {"stringValue": "' +
					linkedParentCustomerInternalID +
					'"},';
				lpoContactDetails += '"role": {"stringValue": "admin"}}}';

				var urlCreateUser =
					"https://firestore.googleapis.com/v1/projects/mp-lpo-connect/databases/lpoconnect/documents/users?documentId=" +
					authID;

				log.debug({
					title: "urlCreateUser",
					details: urlCreateUser
				});

				var headerObj = {
					name: "Content-Type",
					value: "application/json"
				};

				var responseUser = https.post({
					url: urlCreateUser,
					body: lpoContactDetails,
					headers: headerObj
				});

				log.debug({
					title: "responseUser",
					details: responseUser
				});

				var myresponseuser_body = responseUser.body;
				var myresponseuser_code = responseUser.code;

				log.debug({
					title: "myresponseuser_body",
					details: myresponseuser_body
				});

				log.debug({
					title: "myresponseuser_code",
					details: myresponseuser_code
				});
			}

			var customerEntityId = leadRecord.getValue({
				fieldId: "entityid"
			});
			var lpoName = leadRecord.getValue({
				fieldId: "companyname"
			});
			var lpoLinkedZeesText = leadRecord.getText({
				fieldId: "custentity_lpo_linked_franchisees"
			});
			var lpoLinkedZees = leadRecord.getValue({
				fieldId: "custentity_lpo_linked_franchisees"
			});
			var lpoNameArray = lpoName.split(" - ");
			lpoName = lpoNameArray[0].trim();
			if (!isNullorEmpty(lpoLinkedZees)) {
				lpoLinkedZees = lpoLinkedZees.toString();
				log.debug({
					title: "lpoLinkedZees",
					details: lpoLinkedZees
				});
				if (lpoLinkedZees.indexOf(",") != -1) {
					var lpoLinkedZeesArray = lpoLinkedZees.split(",");
				} else {
					var lpoLinkedZeesArray = [];
					lpoLinkedZeesArray.push(lpoLinkedZees);
				}
			}
			log.debug({
				title: "lpoLinkedZeesArray",
				details: lpoLinkedZeesArray
			});

			//Search Name: LPO Sub Customer - Active Services List
			// var serviceListCustInternalIDs = [];
			// serviceListCustInternalIDs.push(addressBookInternalIDs);

			// log.debug({
			//     title: 'serviceListCustInternalIDs',
			//     details: serviceListCustInternalIDs
			// })
			var lpoSubCustomerListSearch = search.load({
				type: "customer",
				id: "customsearch_lpo_sub_customer_list"
			});

			lpoSubCustomerListSearch.filters.push(
				search.createFilter({
					name: "internalid",
					join: "parentcustomer",
					operator: search.Operator.ANYOF,
					values: linkedParentCustomerInternalID
				})
			);
			lpoSubCustomerListSearch.filters.push(
				search.createFilter({
					name: "partner",
					join: null,
					operator: search.Operator.ANYOF,
					values: lpoLinkedZeesArray
				})
			);

			var serviceList = [];
			var countServiceList = 0;
			var oldLPOSubCustomerInternalId = 0;
			var lpoSubCustomerServiceToBeCreatedInternalID = 0;

			lpoSubCustomerListSearch.run().each(function (resultSet) {
				var lpoSubCustomerInternalID = resultSet.getValue({
					name: "internalid"
				});

				var service = {
					id: resultSet.getValue({
						name: "internalid",
						join: "CUSTRECORD_SERVICE_CUSTOMER"
					}),
					name: resultSet.getValue({
						name: "name",
						join: "CUSTRECORD_SERVICE_CUSTOMER"
					}),
					rate: resultSet.getValue({
						name: "custrecord_service_price",
						join: "CUSTRECORD_SERVICE_CUSTOMER"
					})
				};
				serviceList.push(service);
				if (
					oldLPOSubCustomerInternalId != 0 &&
					oldLPOSubCustomerInternalId != lpoSubCustomerInternalID
				) {
					lpoSubCustomerServiceToBeCreatedInternalID =
						oldLPOSubCustomerInternalId;
					return false; //Stop the loop if we have already processed the sub customer
				}

				oldLPOSubCustomerInternalId = lpoSubCustomerInternalID;
				countServiceList++;
				return true;
			});

			if (countServiceList > 0) {
				lpoSubCustomerServiceToBeCreatedInternalID =
					oldLPOSubCustomerInternalId;
			}

			log.debug({
				title: "lpoSubCustomerServiceToBeCreatedInternalID",
				details: lpoSubCustomerServiceToBeCreatedInternalID
			});
			log.debug({
				title: "serviceList",
				details: serviceList
			});

			//Load Partner Record to get the AP Suburb Mapping JSON
			var lpoSuburbMappingJSON = [];
			var activeOperator = [];

			for (var x = 0; x < lpoLinkedZeesArray.length; x++) {
				var partnerRecord = record.load({
					type: record.Type.PARTNER,
					id: lpoLinkedZeesArray[x]
				});

				var zeeJSONString = partnerRecord.getValue({
					fieldId: "custentity_ap_suburbs_json"
				});
				var zeeLocation = partnerRecord.getText({
					fieldId: "location"
				});

				var zeeJSON = JSON.parse(zeeJSONString);
				zeeJSON.forEach(function (suburb) {
					if (!isNullorEmpty(suburb.parent_lpo_id)) {
						if (suburb.parent_lpo_id == linkedParentCustomerInternalID) {
							lpoSuburbMappingJSON.push(suburb);
							if (!isNullorEmpty(suburb.primary_op)) {
								if (Array.isArray(suburb.primary_op)) {
									for (var i = 0; i < suburb.primary_op.length; i++) {
										activeOperator.push(suburb.primary_op[i]);
									}
								} else {
									activeOperator.push(suburb.primary_op);
								}
							}
						}
					}
				});
			}

			log.debug({
				title: "activeOperator",
				details: activeOperator
			});

			activeOperator = removeDuplicates(activeOperator);

			log.debug({
				title: "lpoSuburbMappingJSON",
				details: lpoSuburbMappingJSON
			});
			log.debug({
				title: "activeOperator",
				details: activeOperator
			});

			//Get the Address of the LPO Customer
			//NetSuite Search: SALESP - Addresses
			var searched_addresses = search.load({
				id: "customsearch_cust_list_site_addresses",
				type: "customer"
			});

			searched_addresses.filters.push(
				search.createFilter({
					name: "internalid",
					operator: search.Operator.ANYOF,
					values: linkedParentCustomerInternalID
				})
			);

			var address1 = "";
			var address2 = "";
			var suburb = "";
			var state = "";
			var postcode = "";
			var latitude = "";
			var longitude = "";

			searched_addresses.run().each(function (resultSetAddresses) {
				address2 = resultSetAddresses.getValue({
					name: "address1",
					join: "Address"
				});
				address1 = resultSetAddresses.getValue({
					name: "address2",
					join: "Address"
				});
				suburb = resultSetAddresses.getValue({
					name: "city",
					join: "Address"
				});
				state = resultSetAddresses.getText({
					name: "state",
					join: "Address"
				});
				postcode = resultSetAddresses.getValue({
					name: "zipcode",
					join: "Address"
				});
				latitude = resultSetAddresses.getValue({
					name: "custrecord_address_lat",
					join: "Address"
				});
				longitude = resultSetAddresses.getValue({
					name: "custrecord_address_lon",
					join: "Address"
				});
				return true;
			});

			//Search: Active Parent LPO Customers - Contacts
			var parentLPOCustomerContactsSearch = search.load({
				type: "customer",
				id: "customsearch_parent_lpo_customers_3"
			});
			parentLPOCustomerContactsSearch.filters.push(
				search.createFilter({
					name: "internalid",
					operator: search.Operator.ANYOF,
					values: linkedParentCustomerInternalID
				})
			);
			// var lpoContactFName;
			// var lpoContactLName;
			// var lpoContactEmail;
			// var lpoContactPhone;

			var parentLPOCustomerContactsSearchResultSet =
				parentLPOCustomerContactsSearch.run();
			parentLPOCustomerContactsSearchResultSet.each(function (resultSet) {
				var lpoContactInternalId = resultSet.getValue({
					name: "internalid",
					join: "contact"
				});
				lpoContactFName = resultSet.getValue({
					name: "firstname",
					join: "contact"
				});
				lpoContactLName = resultSet.getValue({
					name: "lastname",
					join: "contact"
				});
				lpoContactEmail = resultSet.getValue({
					name: "email",
					join: "contact"
				});
				lpoContactPhone = resultSet.getValue({
					name: "phone",
					join: "contact"
				});

				log.debug({
					title: "LPO Contact Details",
					details: {
						firstName: lpoContactFName,
						lastName: lpoContactLName,
						email: lpoContactEmail,
						phone: lpoContactPhone
					}
				});

				if (isNullorEmpty(primaryContactId)) {
					var headerObj = {
						name: "Content-Type",
						value: "application/json"
					};
					var responseUserAuth = https.post({
						url: "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyDklo95QYbj4PGZeKAqRBBzCfFKc9CFoXs",
						body: {
							email: lpoContactEmail,
							password: lpoDefaultPassword,
							returnSecureToken: true
						},
						headers: headerObj
					});

					//{"type":"http.ClientResponse","code":200,"headers":{"Alt-Svc":"h3=\":443\"; ma=2592000,h3-29=\":443\"; ma=2592000","alt-svc":"h3=\":443\"; ma=2592000,h3-29=\":443\"; ma=2592000","Cache-Control":"no-cache, no-store, max-age=0, must-revalidate","cache-control":"no-cache, no-store, max-age=0, must-revalidate","Content-Type":"application/json; charset=UTF-8","content-type":"application/json; charset=UTF-8","Date":"Fri, 17 Apr 2026 04:26:08 GMT","date":"Fri, 17 Apr 2026 04:26:08 GMT","Expires":"Mon, 01 Jan 1990 00:00:00 GMT","expires":"Mon, 01 Jan 1990 00:00:00 GMT","Pragma":"no-cache","pragma":"no-cache","Server":"ESF","server":"ESF","Transfer-Encoding":"chunked","transfer-encoding":"chunked","Vary":"Origin","vary":"Origin","Via":"1.1 mono003.prod-mel-ap3.core.ns.internal","via":"1.1 mono003.prod-mel-ap3.core.ns.internal","X-Content-Type-Options":"nosniff","x-content-type-options":"nosniff","X-Frame-Options":"SAMEORIGIN","x-frame-options":"SAMEORIGIN","X-XSS-Protection":"0","x-xss-protection":"0","X-Xss-Protection":"0"},"body":"{\n \"kind\": \"identitytoolkit#SignupNewUserResponse\",\n \"idToken\": \"eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwZmM5YzU0YjhiMjQyMWZmMTgyOTgxNTQyZmQ0NjRlOWJlYzM1NDUiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vbXAtbHBvLWNvbm5lY3QiLCJhdWQiOiJtcC1scG8tY29ubmVjdCIsImF1dGhfdGltZSI6MTc3NjM5OTk2OCwidXNlcl9pZCI6Iml4d3cyQ2huZ3lkQkQ4aXdNTEp1TzRhT3JBOTIiLCJzdWIiOiJpeHd3MkNobmd5ZEJEOGl3TUxKdU80YU9yQTkyIiwiaWF0IjoxNzc2Mzk5OTY4LCJleHAiOjE3NzY0MDM1NjgsImVtYWlsIjoiYW5raXRocmF2aW5kcmFuM0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsiYW5raXRocmF2aW5kcmFuM0BnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.mfVlY9ugrabC2BfThli_QndJsOB9iMJEkS65PkTlhXqOWOqM8b0nf8lWOSS8BIWUCMGF5ePUp7yOm3MDW7__DmT61r5DZjgDMgILpv4GDc744Pc982-fGZot4NMv4ieWekUnV9ksxcoCrCaDQU5OdINdV45Sr1lHUW1NXJSbEJmmNeJFKDKzv2z79zh0zzJLA3zayh4AiHGj-dETgF1DA0wXpkJ7oWDwgfNVZ0GcVfEhl6lygNTaF_ySJpuCCP0-vaaHJlU-JnpqSzjDezXvszL_Krw5xHRjp2nUhMxRnIRCWI5lqM5AXse0t_JTAlOiCXtvrw23LzI3h4WM-HzNPQ\",\n \"email\": \"ankithravindran3@gmail.com\",\n \"refreshToken\": \"AMf-vBxkXbY2JGFwI6LrWku9FhLq1W8kNPG_EMdqH5wKvXrXAumMhYcOrqIjP7lNcFpt-7kH68B4GYi4n7-K-J87QdOJFUdJNxskQJzS2d73ac3ZdlsxGandScSerOt9qxwSq4O1jvCpvGU1iYpTTzWAIHdWQFUuhZm0RMWi7RW0CWzfPX-Iww-NNUlL4hiuK8DBMmEpYxxyeUtMkpFBtjjNS97fhRIsvw\",\n \"expiresIn\": \"3600\",\n \"localId\": \"ixww2ChngydBD8iwMLJuO4aOrA92\"\n}\n"}
					log.debug({
						title: "responseUserAuth",
						details: responseUserAuth
					});

					log.debug({
						title: "JSON.parse(responseUserAuth.body)",
						details: JSON.parse(responseUserAuth.body)
					});

					var parsedResponseUserAuthBody = JSON.parse(responseUserAuth.body);

					log.debug({
						title: "parsedResponseUserAuthBody.localId",
						details: parsedResponseUserAuthBody.localId
					});

					var authID = parsedResponseUserAuthBody.localId;

					var lpoContactDetails = '{"fields": {';
					lpoContactDetails +=
						'"first_name": {"stringValue": "' + lpoContactFName + '"},';
					lpoContactDetails +=
						'"last_name": {"stringValue": "' + lpoContactLName + '"},';
					lpoContactDetails +=
						'"email": {"stringValue": "' + lpoContactEmail + '"},';
					lpoContactDetails +=
						'"phone": {"stringValue": "' + lpoContactPhone + '"},';
					lpoContactDetails +=
						'"lpo_id": {"stringValue": "' +
						linkedParentCustomerInternalID +
						'"},';
					lpoContactDetails += '"role": {"stringValue": "admin"}}}';

					var urlCreateUser =
						"https://firestore.googleapis.com/v1/projects/mp-lpo-connect/databases/lpoconnect/documents/users?documentId=" +
						authID;

					log.debug({
						title: "urlCreateUser",
						details: urlCreateUser
					});

					var headerObj = {
						name: "Content-Type",
						value: "application/json"
					};

					var responseUser = https.post({
						url: urlCreateUser,
						body: lpoContactDetails,
						headers: headerObj
					});

					log.debug({
						title: "responseUser",
						details: responseUser
					});

					var myresponseuser_body = responseUser.body;
					var myresponseuser_code = responseUser.code;

					log.debug({
						title: "myresponseuser_body",
						details: myresponseuser_body
					});

					log.debug({
						title: "myresponseuser_code",
						details: myresponseuser_code
					});
				}

				return true;
			});

			var lpoDetails = '{"fields": {';
			lpoDetails +=
				'"lpo_id": {"stringValue": "' + linkedParentCustomerInternalID + '"},';
			lpoDetails += '"name": {"stringValue": "' + lpoName + '"},';
			lpoDetails += '"address1": {"stringValue": "' + address1 + '"},';
			lpoDetails += '"street": {"stringValue": "' + address2 + '"},';
			lpoDetails += '"city": {"stringValue": "' + suburb + '"},';
			lpoDetails += '"Location": {"stringValue": "' + suburb + '"},';
			lpoDetails += '"state": {"stringValue": "' + state + '"},';
			lpoDetails += '"zip": {"stringValue": "' + postcode + '"},';
			lpoDetails += '"latitude": {"stringValue": "' + latitude + '"},';
			lpoDetails += '"longitude": {"stringValue": "' + longitude + '"},';
			lpoDetails += '"franchiseeTerritoryJSON": {"arrayValue": { "values": [';
			lpoSuburbMappingJSON.forEach(function (suburb) {
				var stringValue =
					suburb.suburbs + ", " + suburb.state + " " + suburb.post_code;
				lpoDetails += '{"stringValue": "' + stringValue + '"},';
			});
			lpoDetails += "]}},";

			//Service Rates
			if (getServiceRate(serviceList, "PMPO") != null) {
				var servicePMPO = getServiceRate(serviceList, "PMPO");
				lpoDetails +=
					'"lpoServicePMPOInternalID": {"stringValue": "' +
					servicePMPO.id +
					'"},';
				lpoDetails +=
					'"lpoServicePMPORate": {"stringValue": "' + servicePMPO.rate + '"},';
			}
			if (getServiceRate(serviceList, "AMPO") != null) {
				var serviceAMPO = getServiceRate(serviceList, "AMPO");
				lpoDetails +=
					'"lpoServiceAMPOInternalID": {"stringValue": "' +
					serviceAMPO.id +
					'"},';
				lpoDetails +=
					'"lpoServiceAMPORate": {"stringValue": "' + serviceAMPO.rate + '"},';
			}
			if (getServiceRate(serviceList, "Package: AMPO & PMPO") != null) {
				var serviceAMPOPMPO = getServiceRate(
					serviceList,
					"Package: AMPO & PMPO"
				);
				lpoDetails +=
					'"lpoServiceAMPOPMPOInternalID": {"stringValue": "' +
					serviceAMPOPMPO.id +
					'"},';
				lpoDetails +=
					'"lpoServiceAMPOPMPORate": {"stringValue": "' +
					serviceAMPOPMPO.rate +
					'"},';
			}

			lpoDetails += "}}";

			log.debug({
				title: "LPO Details",
				details: lpoDetails
			});

			var urlCreateLPO =
				"https://firestore.googleapis.com/v1/projects/mp-lpo-connect/databases/lpoconnect/documents/lpo?documentId=" +
				linkedParentCustomerInternalID;

			log.debug({
				title: "urlCreateLPO",
				details: urlCreateLPO
			});

			var headerObj = {
				name: "Content-Type",
				value: "application/json"
			};

			var responseLPO = https.post({
				url: urlCreateLPO,
				body: lpoDetails,
				headers: headerObj
			});

			log.debug({
				title: "responseLPO",
				details: responseLPO
			});

			var myresponselpo_body = responseLPO.body;
			var myresponselpo_code = responseLPO.code;

			log.debug({
				title: "myresponselpo_body",
				details: myresponselpo_body
			});

			log.debug({
				title: "myresponselpo_code",
				details: myresponselpo_code
			});

			leadRecord.setValue({
				fieldId: "custentity_lpo_synced_with_db",
				value: 1
			});
			linkedParentCustomerInternalID = leadRecord.save({
				ignoreMandatoryFields: true
			});

			return true;
		});
	}
	return {
		execute: execute
	};

	function getSalesRepWithMinCount(salesReps, salesRepCounts) {
		// Find the minimum count among all sales reps
		var minCount = null;
		for (var i = 0; i < salesReps.length; i++) {
			var count = salesRepCounts[salesReps[i]];
			if (minCount === null || count < minCount) {
				minCount = count;
			}
		}
		// Collect all sales reps with the minimum count
		var eligibleSalesReps = [];
		for (var i = 0; i < salesReps.length; i++) {
			if (salesRepCounts[salesReps[i]] === minCount) {
				eligibleSalesReps.push(salesReps[i]);
			}
		}
		return eligibleSalesReps;
	}

	function getDialersWithMinCount(dialers, dialerCounts) {
		// Find the minimum count among all dialers
		var minCount = null;
		for (var i = 0; i < dialers.length; i++) {
			var count = dialerCounts[dialers[i]];
			if (minCount === null || count < minCount) {
				minCount = count;
			}
		}
		// Collect all dialers with the minimum count
		var eligibleDialers = [];
		for (var i = 0; i < dialers.length; i++) {
			if (dialerCounts[dialers[i]] === minCount) {
				eligibleDialers.push(dialers[i]);
			}
		}
		return eligibleDialers;
	}

	function getDateStoreNS() {
		var date = new Date();
		// if (date.getHours() > 6) {
		//     date.setDate(date.getDate() + 1);
		// }

		format.format({
			value: date,
			type: format.Type.DATE,
			timezone: format.Timezone.AUSTRALIA_SYDNEY
		});

		return date;
	}

	// Shuffle dialers for initial randomness
	function shuffle(array) {
		for (var i = array.length - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var temp = array[i];
			array[i] = array[j];
			array[j] = temp;
		}
		return array;
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

	/**
	 * Is Null or Empty.
	 *
	 * @param {Object} strVal
	 */
	function isNullorEmpty(strVal) {
		return (
			strVal == null ||
			strVal == "" ||
			strVal == "null" ||
			strVal == undefined ||
			strVal == "undefined" ||
			strVal == "- None -"
		);
	}
});
