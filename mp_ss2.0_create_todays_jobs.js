/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * Author:               Ankith Ravindran
 * Created on:           Wed Apr 29 2026
 * Modified on:          Wed Apr 29 2026 08:05:47
 * SuiteScript Version:  2.0
 * Description:          Schedule Script to create todays jobs in NetSuite and MP Operator App. Run everyday at 3:00AM.
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
	var apiHeaders = {};
	apiHeaders["Content-Type"] = "application/json";
	apiHeaders["Accept"] = "application/json";
	apiHeaders["GENERAL-API-KEY"] = "708aa067-d67d-73e6-8967-66786247f5d7";

	function execute(context) {
		var todayDateYYYYMMDD = null;
		todayDateYYYYMMDD = getTodaysDate();

		log.debug({
			title: "todayDateYYYYMMDD",
			details: todayDateYYYYMMDD
		});

		var date = new Date();
		var date_now = format.parse({
			value: date,
			type: format.Type.DATE
		});
		var time_now = format.parse({
			value: date,
			type: format.Type.TIMEOFDAY
		});

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

		var firebaseLeadURL =
			"https://firestore.googleapis.com/v1/projects/mp-lpo-connect/databases/lpoconnect/documents:runQuery";

		var apiHeaders = {};
		apiHeaders["Content-Type"] = "application/json";
		apiHeaders["Accept"] = "*/*";
		apiHeaders["Authorization"] = "Bearer " + idToken;

		// var jobQuery = {
		//     "structuredQuery": {
		//         "from": [{ "collectionId": "jobs" }],
		//         "where": {
		//             "fieldFilter": {
		//                 "field": { "fieldPath": "date" },
		//                 "op": "EQUAL",
		//                 "value": { "stringValue": "" + tomorrowDateYYYYMMDD + "" }
		//             }
		//         }
		//     }
		// }

		var jobQuery = {
			structuredQuery: {
				from: [{ collectionId: "jobs" }],
				where: {
					compositeFilter: {
						op: "AND",
						filters: [
							{
								fieldFilter: {
									field: { fieldPath: "date" },
									op: "EQUAL",
									value: { stringValue: "" + todayDateYYYYMMDD + "" }
								}
							},
							{
								fieldFilter: {
									field: { fieldPath: "syncedWithNetSuite" },
									op: "EQUAL",
									value: { booleanValue: false }
								}
							}
						]
					}
				}
			}
		};

		var responseTodaysJobs = https.request({
			method: https.Method.POST,
			url: firebaseLeadURL,
			headers: apiHeaders,
			body: JSON.stringify(jobQuery)
		});

		var dbBody = responseTodaysJobs.body;
		log.audit({
			title: "Lead Firebase Data",
			details: dbBody
		});
		var responseObj = JSON.parse(dbBody);

		log.audit({
			title: "Number of Jobs",
			details: responseObj.length
		});

		//loop through the jobs
		for (var i = 0; i < responseObj.length; i++) {
			if (!isNullorEmpty(responseObj[i].document.name)) {
				var jobRESTURL = responseObj[i].document.name; //projects/mp-lpo-connect/databases/lpoconnect/documents/jobs/JLHw2WgJhyMawSt6fJJ7
				var job_id = jobRESTURL.split("jobs/").pop();

				log.debug({
					title: "Job REST URL",
					details: jobRESTURL
				});
				log.debug({
					title: "Job ID from URL",
					details: job_id
				});

				var job = responseObj[i].document.fields;

				log.debug({
					title: "Job " + i,
					details: job
				});

				var flat = extractKeyValuePairs(job);
				log.debug({
					title: "Flattened Job " + i,
					details: flat
				});

				var request_id = flat.id;
				var jobType = flat.jobType;

				var service = flat.service;
				var customerInternalId = flat.netsuiteCustomerId;
				var jobDate = flat.date;

				var dateDDMMYYYY = convertDateToDDMMYYYY("" + flat.date + "");
				var netsuiteLPOServiceDateDateFormat = dateSelected2Date(
					"" + flat.date + ""
				);

				log.debug({
					title: "Service Date",
					details: dateDDMMYYYY
				});
				log.debug({
					title: "NetSuite LPO Service Date Format",
					details: netsuiteLPOServiceDateDateFormat
				});

				//Load Customer Record.
				var customerRecord = record.load({
					type: "customer",
					id: customerInternalId
				});

				var siteCompanyName = customerRecord.getValue({
					fieldId: "companyname"
				});
				var companyLinkedZee = customerRecord.getValue({
					fieldId: "partner"
				});

				//Load Site Address
				//NetSuite Search: Customer List - Site Addresses
				var siteAddressesSearch = search.load({
					id: "customsearch_cust_list_site_addresses",
					type: "customer"
				});

				siteAddressesSearch.filters.push(
					search.createFilter({
						name: "internalid",
						join: null,
						operator: search.Operator.ANYOF,
						values: customerInternalId
					})
				);

				var shippingAddress1 = null;
				var shippingAddress2 = null;
				var shippingCity = null;
				var shippingStateProvince = null;
				var shippingZip = null;
				var shippingLat = null;
				var shippingLon = null;
				siteAddressesSearch.run().each(function (siteAddressesSearchResultSet) {
					shippingAddress1 = siteAddressesSearchResultSet.getValue({
						name: "address1",
						join: "Address"
					});
					shippingAddress2 = siteAddressesSearchResultSet.getValue({
						name: "address2",
						join: "Address"
					});
					shippingCity = siteAddressesSearchResultSet.getValue({
						name: "city",
						join: "Address"
					});
					shippingStateProvince = siteAddressesSearchResultSet.getValue({
						name: "state",
						join: "Address"
					});
					shippingZip = siteAddressesSearchResultSet.getValue({
						name: "zipcode",
						join: "Address"
					});

					shippingLat = siteAddressesSearchResultSet.getValue({
						name: "custrecord_address_lat",
						join: "Address",
						summary: "GROUP"
					});
					shippingLon = siteAddressesSearchResultSet.getValue({
						name: "custrecord_address_lon",
						join: "Address",
						summary: "GROUP"
					});
				});

				log.debug({
					title: "Shipping Address",
					details:
						shippingAddress1 +
						" " +
						shippingAddress2 +
						", " +
						shippingCity +
						", " +
						shippingStateProvince +
						" " +
						shippingZip
				});

				var lpoParentCustomerInternalID = flat.lpo_id;

				var lpoParentCustomerRecord = record.load({
					type: record.Type.CUSTOMER,
					id: lpoParentCustomerInternalID
				});
				var lpoName = lpoParentCustomerRecord.getValue({
					fieldId: "companyname"
				});

				var lpoLinkedZees = lpoParentCustomerRecord.getValue({
					fieldId: "custentity_lpo_linked_franchisees"
				});
				var lpoNameArray = lpoName.split(" - ");
				lpoName = lpoNameArray[0].trim();

				//Search: Active Parent LPO Customers - Contacts
				var parentLPOCustomerContactsSearch = search.load({
					type: "customer",
					id: "customsearch_parent_lpo_customers_3"
				});
				parentLPOCustomerContactsSearch.filters.push(
					search.createFilter({
						name: "internalid",
						operator: search.Operator.ANYOF,
						values: lpoParentCustomerInternalID
					})
				);
				var lpoContactFName = null;
				var lpoContactLName = null;
				var lpoContactEmail = null;
				var lpoContactPhone = null;

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
					return true;
				});

				//Load Site Address
				//NetSuite Search: Customer List - Site Addresses
				var siteAddressesSearch = search.load({
					id: "customsearch_cust_list_site_addresses",
					type: "customer"
				});

				siteAddressesSearch.filters.push(
					search.createFilter({
						name: "internalid",
						join: null,
						operator: search.Operator.ANYOF,
						values: lpoParentCustomerInternalID
					})
				);

				var lpoShippingAddress1 = null;
				var lpoShippingAddress2 = null;
				var lpoShippingCity = null;
				var lpoShippingStateProvince = null;
				var lpoShippingZip = null;
				var lpoShippingLat = null;
				var lpoShippingLon = null;
				siteAddressesSearch.run().each(function (siteAddressesSearchResultSet) {
					lpoShippingAddress1 = siteAddressesSearchResultSet.getValue({
						name: "address1",
						join: "Address"
					});
					lpoShippingAddress2 = siteAddressesSearchResultSet.getValue({
						name: "address2",
						join: "Address"
					});
					lpoShippingCity = siteAddressesSearchResultSet.getValue({
						name: "city",
						join: "Address"
					});
					lpoShippingStateProvince = siteAddressesSearchResultSet.getValue({
						name: "state",
						join: "Address"
					});
					lpoShippingZip = siteAddressesSearchResultSet.getValue({
						name: "zipcode",
						join: "Address"
					});

					lpoShippingLat = siteAddressesSearchResultSet.getValue({
						name: "custrecord_address_lat",
						join: "Address",
						summary: "GROUP"
					});
					lpoShippingLon = siteAddressesSearchResultSet.getValue({
						name: "custrecord_address_lon",
						join: "Address",
						summary: "GROUP"
					});
				});

				log.debug({
					title: "LPO Shipping Address",
					details:
						lpoShippingAddress1 +
						" " +
						lpoShippingAddress2 +
						", " +
						lpoShippingCity +
						", " +
						lpoShippingStateProvince +
						" " +
						lpoShippingZip
				});

				var serviceInternalId = flat.serviceInternalId;
				var serviceType = flat.service;
				var billing = flat.billing;

				if (!isNullorEmpty(flat.preferredTime)) {
					var currentTime = flat.preferredTime;
				} else {
					var currentTime = "12:00 PM";
				}

				var customerContactName =
					flat["customer.firstName"] + " " + flat["customer.lastName"];
				var customerContactEmail = flat["customer.email"];
				var customerContactPhone = flat["customer.phone"];

				var instructions = flat["customer.instructions"];

				var lpoSuburbMappingJSON = [];
				var activeOperator = [];
				var partnerRecord = record.load({
					type: record.Type.PARTNER,
					id: companyLinkedZee
				});

				if (!isNullorEmpty(lpoParentCustomerInternalID)) {
					var zeeJSONString = partnerRecord.getValue({
						fieldId: "custentity_ap_suburbs_json"
					});
				} else {
					var zeeJSONString = partnerRecord.getValue({
						fieldId: "custentity_zee_territory_json"
					});
				}

				log.debug({
					title: "zeeJSONString",
					details: zeeJSONString
				});

				var zeeJSON = JSON.parse(zeeJSONString);
				zeeJSON.forEach(function (suburb) {
					lpoSuburbMappingJSON.push(suburb);
					if (!isNullorEmpty(suburb.parent_lpo_id)) {
						if (
							suburb.parent_lpo_id == lpoParentCustomerInternalID &&
							suburb.suburbs.toUpperCase() == shippingCity.toUpperCase() &&
							suburb.post_code == shippingZip &&
							suburb.state.toUpperCase() == shippingStateProvince.toUpperCase()
						) {
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
				activeOperator = removeDuplicates(activeOperator);

				log.debug({
					title: "activeOperator",
					details: activeOperator
				});

				if (serviceType == "site-to-lpo") {
					//PMPO
					// Create App Job Group
					var appJobGroupID = createAppJobGroup(
						"PMPO",
						customerInternalId,
						companyLinkedZee,
						serviceInternalId,
						dateDDMMYYYY,
						netsuiteLPOServiceDateDateFormat,
						job_id
					);

					var appJobGroupRecord = record.load({
						type: "customrecord_jobgroup",
						id: appJobGroupID
					});

					var app_job_group_name = appJobGroupRecord.getValue({
						fieldId: "name"
					});

					var stopNameForPickup = "PICKUP - " + siteCompanyName.toUpperCase();

					//Create App Jobs for Site Delivery
					var app_job_id_1 = createAppJobs(
						customerInternalId,
						siteCompanyName.toUpperCase(),
						serviceInternalId,
						currentTime,
						appJobGroupID,
						shippingAddress1 + " " + shippingAddress2,
						shippingCity,
						shippingStateProvince,
						shippingZip,
						shippingLat,
						shippingLon,
						companyLinkedZee,
						instructions,
						null,
						null,
						"adhoc",
						siteCompanyName,
						app_job_group_name,
						netsuiteLPOServiceDateDateFormat,
						dateDDMMYYYY,
						2,
						customerContactName,
						"",
						customerContactEmail,
						customerContactPhone,
						jobDate,
						stopNameForPickup,
						activeOperator
					);
					log.debug({
						title: "Pickup Job ID",
						details: app_job_id_1
					});

					var stopNameForDelivery = "DELIVERY - " + lpoName.toUpperCase();

					//Create App Jobs for LPO Delivery
					var app_job_id_2 = createAppJobs(
						customerInternalId,
						lpoName.toUpperCase(),
						serviceInternalId,
						currentTime,
						appJobGroupID,
						lpoShippingAddress1 + " " + lpoShippingAddress2,
						lpoShippingCity,
						lpoShippingStateProvince,
						lpoShippingZip,
						lpoShippingLat,
						lpoShippingLon,
						companyLinkedZee,
						instructions,
						null,
						3,
						"adhoc",
						siteCompanyName,
						app_job_group_name,
						netsuiteLPOServiceDateDateFormat,
						dateDDMMYYYY,
						1,
						lpoContactFName + " " + lpoContactLName,
						"",
						lpoContactEmail,
						lpoContactPhone,
						jobDate,
						stopNameForDelivery,
						activeOperator
					);

					log.debug({
						title: "Delivery Job ID",
						details: app_job_id_2
					});

					var updateJobCollectionJSON = {
						fields: {
							appJobGroupId: {
								stringValue: "" + appJobGroupID + ""
							},
							syncedWithNetSuite: {
								booleanValue: true
							},
							stops: {
								arrayValue: {
									values: [
										{
											mapValue: {
												fields: {
													type: { stringValue: "pickup" },
													label: { stringValue: "Pickup Site" },
													locationName: {
														stringValue: "" + siteCompanyName + ""
													},
													address: {
														stringValue:
															"" +
															shippingAddress1 +
															" " +
															shippingAddress2 +
															""
													},
													suburb: { stringValue: "" + shippingCity + "" },
													state: {
														stringValue: "" + shippingStateProvince + ""
													},
													postcode: { stringValue: "" + shippingZip + "" },
													sequence: { integerValue: "1" },
													status: { stringValue: "pending" },
													appJobId: { stringValue: "" + app_job_id_1 + "" },
													lat: { stringValue: "" + shippingLat + "" },
													lng: { stringValue: "" + shippingLon + "" }
												}
											}
										},
										{
											mapValue: {
												fields: {
													type: { stringValue: "delivery" },
													label: { stringValue: "Delivery LPO" },
													locationName: {
														stringValue: "" + lpoName + ""
													},
													address: {
														stringValue:
															"" +
															lpoShippingAddress1 +
															" " +
															lpoShippingAddress2 +
															""
													},
													suburb: { stringValue: "" + lpoShippingCity + "" },
													state: {
														stringValue: "" + lpoShippingStateProvince + ""
													},
													postcode: { stringValue: "" + lpoShippingZip + "" },
													sequence: { integerValue: "2" },
													status: { stringValue: "pending" },
													appJobId: { stringValue: "" + app_job_id_2 + "" },
													lat: { stringValue: "" + lpoShippingLat + "" },
													lng: { stringValue: "" + lpoShippingLon + "" }
												}
											}
										}
									]
								}
							}
						}
					};

					var firebaseUpdateURL =
						"https://firestore.googleapis.com/v1/projects/mp-lpo-connect/databases/lpoconnect/documents/jobs/" +
						job_id +
						"?updateMask.fieldPaths=stops&updateMask.fieldPaths=appJobGroupId&updateMask.fieldPaths=syncedWithNetSuite";
					var apiHeaders = {};
					apiHeaders["Content-Type"] = "application/json";
					apiHeaders["Accept"] = "*/*";
					apiHeaders["X-HTTP-Method-Override"] = "PATCH";

					var response = https.request({
						method: https.Method.POST,
						url: firebaseUpdateURL,
						body: JSON.stringify(updateJobCollectionJSON),
						headers: apiHeaders
					});

					var myresponse_body = response.body;
					var myresponse_code = response.code;

					log.debug({
						title: "myresponse_body",
						details: myresponse_body
					});

					log.debug({
						title: "myresponse_code",
						details: myresponse_code
					});
				} else if (serviceType == "lpo-to-site") {
					//AMPO
					// Create App Job Group
					var appJobGroupID = createAppJobGroup(
						"AMPO",
						customerInternalId,
						companyLinkedZee,
						serviceInternalId,
						dateDDMMYYYY,
						netsuiteLPOServiceDateDateFormat,
						job_id
					);

					log.debug({
						title: "App Job Group ID",
						details: appJobGroupID
					});

					var appJobGroupRecord = record.load({
						type: "customrecord_jobgroup",
						id: appJobGroupID
					});

					var app_job_group_name = appJobGroupRecord.getValue({
						fieldId: "name"
					});

					var stopNameForPickup = "PICKUP - " + lpoName.toUpperCase();

					//Create App Jobs for LPO PickUp
					var app_job_id_1 = createAppJobs(
						customerInternalId,
						lpoName.toUpperCase(),
						serviceInternalId,
						currentTime,
						appJobGroupID,
						lpoShippingAddress1 + " " + lpoShippingAddress2,
						lpoShippingCity,
						lpoShippingStateProvince,
						lpoShippingZip,
						lpoShippingLat,
						lpoShippingLon,
						companyLinkedZee,
						instructions,
						null,
						3,
						"adhoc",
						siteCompanyName,
						app_job_group_name,
						netsuiteLPOServiceDateDateFormat,
						dateDDMMYYYY,
						1,
						lpoContactFName + " " + lpoContactLName,
						"",
						lpoContactEmail,
						lpoContactPhone,
						jobDate,
						stopNameForPickup,
						activeOperator
					);

					log.debug({
						title: "Pickup Job ID",
						details: app_job_id_1
					});

					var stopNameForDelivery =
						"DELIVERY - " + siteCompanyName.toUpperCase();
					//Create App Jobs for Site Delivery
					var app_job_id_2 = createAppJobs(
						customerInternalId,
						siteCompanyName.toUpperCase(),
						serviceInternalId,
						currentTime,
						appJobGroupID,
						shippingAddress1 + " " + shippingAddress2,
						shippingCity,
						shippingStateProvince,
						shippingZip,
						shippingLat,
						shippingLon,
						companyLinkedZee,
						instructions,
						null,
						null,
						"adhoc",
						siteCompanyName,
						app_job_group_name,
						netsuiteLPOServiceDateDateFormat,
						dateDDMMYYYY,
						2,
						customerContactName,
						"",
						customerContactEmail,
						customerContactPhone,
						jobDate,
						stopNameForDelivery,
						activeOperator
					);
					log.debug({
						title: "Delivery Job ID",
						details: app_job_id_2
					});

					var updateJobCollectionJSON = {
						fields: {
							appJobGroupId: {
								stringValue: "" + appJobGroupID + ""
							},
							syncedWithNetSuite: {
								booleanValue: true
							},
							stops: {
								arrayValue: {
									values: [
										{
											mapValue: {
												fields: {
													type: { stringValue: "pickup" },
													label: { stringValue: "Pickup LPO" },
													locationName: {
														stringValue: "" + lpoName + ""
													},
													address: {
														stringValue:
															"" +
															lpoShippingAddress1 +
															" " +
															lpoShippingAddress2 +
															""
													},
													suburb: { stringValue: "" + lpoShippingCity + "" },
													state: {
														stringValue: "" + lpoShippingStateProvince + ""
													},
													postcode: { stringValue: "" + lpoShippingZip + "" },
													sequence: { integerValue: "1" },
													status: { stringValue: "pending" },
													appJobId: { stringValue: "" + app_job_id_1 + "" },
													lat: { stringValue: "" + lpoShippingLat + "" },
													lng: { stringValue: "" + lpoShippingLon + "" }
												}
											}
										},
										{
											mapValue: {
												fields: {
													type: { stringValue: "delivery" },
													label: { stringValue: "Delivery Site" },
													locationName: {
														stringValue: "" + siteCompanyName + ""
													},
													address: {
														stringValue:
															"" +
															shippingAddress1 +
															" " +
															shippingAddress2 +
															""
													},
													suburb: { stringValue: "" + shippingCity + "" },
													state: {
														stringValue: "" + shippingStateProvince + ""
													},
													postcode: { stringValue: "" + shippingZip + "" },
													sequence: { integerValue: "2" },
													status: { stringValue: "pending" },
													appJobId: { stringValue: "" + app_job_id_2 + "" },
													lat: { stringValue: "" + shippingLat + "" },
													lng: { stringValue: "" + shippingLon + "" }
												}
											}
										}
									]
								}
							}
						}
					};

					var firebaseUpdateURL =
						"https://firestore.googleapis.com/v1/projects/mp-lpo-connect/databases/lpoconnect/documents/jobs/" +
						job_id +
						"?updateMask.fieldPaths=stops&updateMask.fieldPaths=appJobGroupId&updateMask.fieldPaths=syncedWithNetSuite";
					var apiHeaders = {};
					apiHeaders["Content-Type"] = "application/json";
					apiHeaders["Accept"] = "*/*";
					apiHeaders["X-HTTP-Method-Override"] = "PATCH";

					var response = https.request({
						method: https.Method.POST,
						url: firebaseUpdateURL,
						body: JSON.stringify(updateJobCollectionJSON),
						headers: apiHeaders
					});

					var myresponse_body = response.body;
					var myresponse_code = response.code;

					log.debug({
						title: "myresponse_body",
						details: myresponse_body
					});

					log.debug({
						title: "myresponse_code",
						details: myresponse_code
					});
				} else if (serviceType == "round-trip") {
					// Create App Job Group
					var appJobGroupID = createAppJobGroup(
						"Package: AMPO & PMPO",
						customerInternalId,
						companyLinkedZee,
						serviceInternalId,
						dateDDMMYYYY,
						netsuiteLPOServiceDateDateFormat,
						job_id
					);

					log.debug({
						title: "App Job Group ID",
						details: appJobGroupID
					});

					var appJobGroupRecord = record.load({
						type: "customrecord_jobgroup",
						id: appJobGroupID
					});

					var app_job_group_name = appJobGroupRecord.getValue({
						fieldId: "name"
					});

					var stopNameForPickup = "PICKUP - " + lpoName.toUpperCase();

					//Create App Jobs for LPO PickUp
					var app_job_id_1 = createAppJobs(
						customerInternalId,
						lpoName.toUpperCase(),
						serviceInternalId,
						currentTime,
						appJobGroupID,
						lpoShippingAddress1 + " " + lpoShippingAddress2,
						lpoShippingCity,
						lpoShippingStateProvince,
						lpoShippingZip,
						lpoShippingLat,
						lpoShippingLon,
						companyLinkedZee,
						instructions,
						null,
						3,
						"adhoc",
						siteCompanyName,
						app_job_group_name,
						netsuiteLPOServiceDateDateFormat,
						dateDDMMYYYY,
						1,
						lpoContactFName + " " + lpoContactLName,
						"",
						lpoContactEmail,
						lpoContactPhone,
						jobDate,
						stopNameForPickup,
						activeOperator
					);

					log.debug({
						title: "Pickup Job ID",
						details: app_job_id_1
					});

					var stopNameForDeliveryPickup =
						"DELIVERY & PICKUP - " + siteCompanyName.toUpperCase();
					//Create App Jobs for Site Delivery
					var app_job_id_2 = createAppJobs(
						customerInternalId,
						siteCompanyName.toUpperCase(),
						serviceInternalId,
						currentTime,
						appJobGroupID,
						shippingAddress1 + " " + shippingAddress2,
						shippingCity,
						shippingStateProvince,
						shippingZip,
						shippingLat,
						shippingLon,
						companyLinkedZee,
						instructions,
						null,
						null,
						"adhoc",
						siteCompanyName,
						app_job_group_name,
						netsuiteLPOServiceDateDateFormat,
						dateDDMMYYYY,
						2,
						customerContactName,
						"",
						customerContactEmail,
						customerContactPhone,
						jobDate,
						stopNameForDeliveryPickup,
						activeOperator
					);
					log.debug({
						title: "Delivery Job ID",
						details: app_job_id_2
					});

					//Create App Jobs for Site Delivery
					var app_job_id_3 = createAppJobs(
						customerInternalId,
						siteCompanyName.toUpperCase(),
						serviceInternalId,
						currentTime,
						appJobGroupID,
						shippingAddress1 + " " + shippingAddress2,
						shippingCity,
						shippingStateProvince,
						shippingZip,
						shippingLat,
						shippingLon,
						companyLinkedZee,
						instructions,
						null,
						null,
						"adhoc",
						siteCompanyName,
						app_job_group_name,
						netsuiteLPOServiceDateDateFormat,
						dateDDMMYYYY,
						3,
						customerContactName,
						"",
						customerContactEmail,
						customerContactPhone,
						jobDate,
						stopNameForDeliveryPickup,
						activeOperator
					);
					log.debug({
						title: "Pickup Job ID",
						details: app_job_id_3
					});

					var stopNameForDelivery = "DELIVERY - " + lpoName.toUpperCase();

					//Create App Jobs for LPO Delivery
					var app_job_id_4 = createAppJobs(
						customerInternalId,
						lpoName.toUpperCase(),
						serviceInternalId,
						currentTime,
						appJobGroupID,
						lpoShippingAddress1 + " " + lpoShippingAddress2,
						lpoShippingCity,
						lpoShippingStateProvince,
						lpoShippingZip,
						lpoShippingLat,
						lpoShippingLon,
						companyLinkedZee,
						instructions,
						null,
						3,
						"adhoc",
						siteCompanyName,
						app_job_group_name,
						netsuiteLPOServiceDateDateFormat,
						dateDDMMYYYY,
						4,
						lpoContactFName + " " + lpoContactLName,
						"",
						lpoContactEmail,
						lpoContactPhone,
						jobDate,
						stopNameForDelivery,
						activeOperator
					);

					log.debug({
						title: "Delivery Job ID",
						details: app_job_id_4
					});

					var updateJobCollectionJSON = {
						fields: {
							appJobGroupId: {
								stringValue: "" + appJobGroupID + ""
							},
							syncedWithNetSuite: {
								booleanValue: true
							},
							stops: {
								arrayValue: {
									values: [
										{
											mapValue: {
												fields: {
													type: { stringValue: "pickup" },
													label: { stringValue: "Pickup LPO" },
													locationName: { stringValue: "" + lpoName + "" },
													address: {
														stringValue:
															"" +
															lpoShippingAddress1 +
															" " +
															lpoShippingAddress2 +
															""
													},
													suburb: { stringValue: "" + lpoShippingCity + "" },
													state: {
														stringValue: "" + lpoShippingStateProvince + ""
													},
													postcode: { stringValue: "" + lpoShippingZip + "" },
													sequence: { integerValue: "1" },
													status: { stringValue: "pending" },
													appJobId: { stringValue: "" + app_job_id_1 + "" },
													lat: { stringValue: "" + lpoShippingLat + "" },
													lng: { stringValue: "" + lpoShippingLon + "" }
												}
											}
										},
										{
											mapValue: {
												fields: {
													type: { stringValue: "delivery" },
													label: { stringValue: "Delivery Site" },
													locationName: {
														stringValue: "" + siteCompanyName + ""
													},
													address: {
														stringValue:
															"" +
															shippingAddress1 +
															" " +
															shippingAddress2 +
															""
													},
													suburb: { stringValue: "" + shippingCity + "" },
													state: {
														stringValue: "" + shippingStateProvince + ""
													},
													postcode: { stringValue: "" + shippingZip + "" },
													sequence: { integerValue: "2" },
													status: { stringValue: "pending" },
													appJobId: { stringValue: "" + app_job_id_2 + "" },
													lat: { stringValue: "" + shippingLat + "" },
													lng: { stringValue: "" + shippingLon + "" }
												}
											}
										},
										{
											mapValue: {
												fields: {
													type: { stringValue: "delivery" },
													label: { stringValue: "Pickup Site" },
													locationName: {
														stringValue: "" + siteCompanyName + ""
													},
													address: {
														stringValue:
															"" +
															shippingAddress1 +
															" " +
															shippingAddress2 +
															""
													},
													suburb: { stringValue: "" + shippingCity + "" },
													state: {
														stringValue: "" + shippingStateProvince + ""
													},
													postcode: { stringValue: "" + shippingZip + "" },
													sequence: { integerValue: "3" },
													status: { stringValue: "pending" },
													appJobId: { stringValue: "" + app_job_id_3 + "" },
													lat: { stringValue: "" + shippingLat + "" },
													lng: { stringValue: "" + shippingLon + "" }
												}
											}
										},
										{
											mapValue: {
												fields: {
													type: { stringValue: "pickup" },
													label: { stringValue: "Delivery LPO" },
													locationName: { stringValue: "" + lpoName + "" },
													address: {
														stringValue:
															"" +
															lpoShippingAddress1 +
															" " +
															lpoShippingAddress2 +
															""
													},
													suburb: { stringValue: "" + lpoShippingCity + "" },
													state: {
														stringValue: "" + lpoShippingStateProvince + ""
													},
													postcode: { stringValue: "" + lpoShippingZip + "" },
													sequence: { integerValue: "4" },
													status: { stringValue: "pending" },
													appJobId: { stringValue: "" + app_job_id_4 + "" },
													lat: { stringValue: "" + lpoShippingLat + "" },
													lng: { stringValue: "" + lpoShippingLon + "" }
												}
											}
										}
									]
								}
							}
						}
					};

					var firebaseUpdateURL =
						"https://firestore.googleapis.com/v1/projects/mp-lpo-connect/databases/lpoconnect/documents/jobs/" +
						job_id +
						"?updateMask.fieldPaths=stops&updateMask.fieldPaths=appJobGroupId";
					var apiHeaders = {};
					apiHeaders["Content-Type"] = "application/json";
					apiHeaders["Accept"] = "*/*";
					apiHeaders["X-HTTP-Method-Override"] = "PATCH";

					var response = https.request({
						method: https.Method.POST,
						url: firebaseUpdateURL,
						body: JSON.stringify(updateJobCollectionJSON),
						headers: apiHeaders
					});

					var myresponse_body = response.body;
					var myresponse_code = response.code;

					log.debug({
						title: "myresponse_body",
						details: myresponse_body
					});

					log.debug({
						title: "myresponse_code",
						details: myresponse_code
					});
				}
			}
		}
	}
	return {
		execute: execute
	};

	/**
	 * @description
	 * @author Ankith Ravindran (AR)
	 * @date 01/05/2024
	 * @param {*} service_leg_service_text
	 * @param {*} service_leg_customer
	 * @param {*} service_leg_zee
	 * @param {*} service_id
	 * @returns {*}
	 */
	function createAppJobGroup(
		service_leg_service_text,
		service_leg_customer,
		service_leg_zee,
		service_id,
		date_of_week,
		netsuiteLPOServiceDateDateFormat,
		localMileJobID
	) {
		log.debug({
			title: "Inside createAppJobGroup > jobid",
			details: localMileJobID
		});
		var app_job_group_rec = record.create({
			type: "customrecord_jobgroup"
		});

		//Search Name: LPO Connect & LocalMile - App Job Groups Created - Get Count
		var getAppJobGroupNameCountSearch = search.load({
			type: "customrecord_jobgroup",
			id: "customsearch_localmile_app_job_groups__4"
		});
		getAppJobGroupNameCountSearch.filters.push(
			search.createFilter({
				name: "name",
				join: null,
				operator: search.Operator.STARTSWITH,
				values: "LPO-" + service_leg_service_text + "_" + date_of_week
			})
		);
		getAppJobGroupNameCountSearch.filters.push(
			search.createFilter({
				name: "internalid",
				join: "custrecord_jobgroup_customer",
				operator: search.Operator.ANYOF,
				values: service_leg_customer
			})
		);

		var jobGroupNameCount = getAppJobGroupNameCountSearch.runPaged().count;

		log.debug({
			title: "jobGroupNameCount",
			details: jobGroupNameCount
		});

		app_job_group_rec.setValue({
			fieldId: "name",
			value:
				"LPO-" +
				service_leg_service_text +
				"_" +
				date_of_week +
				"_" +
				(jobGroupNameCount + 1)
		});
		app_job_group_name =
			service_leg_service_text +
			"_" +
			date_of_week +
			"_" +
			(jobGroupNameCount + 1);
		app_job_group_rec.setValue({
			fieldId: "custrecord_jobgroup_ref",
			value:
				"LPO-" +
				service_leg_service_text +
				"_" +
				date_of_week +
				"_" +
				(jobGroupNameCount + 1)
		});
		app_job_group_rec.setValue({
			fieldId: "custrecord_jobgroup_customer",
			value: service_leg_customer
		});
		app_job_group_rec.setValue({
			fieldId: "custrecord_jobgroup_franchisee",
			value: service_leg_zee
		});
		app_job_group_rec.setValue({
			fieldId: "custrecord_jobgroup_service",
			value: service_id
		});
		app_job_group_rec.setValue({
			fieldId: "custrecord_jobgroup_status",
			value: 4
		});
		app_job_group_rec.setValue({
			fieldId: "custrecord_lpo_hub_job_id",
			value: localMileJobID
		});
		var app_job_group_id = app_job_group_rec.save();

		return app_job_group_id;
	}
	/**
	 * @description
	 * @author Ankith Ravindran (AR)
	 * @date 02/05/2024
	 * @param {*} appServiceStopCustomer
	 * @param {*} appServiceStopStopName
	 * @param {*} appServiceStopService
	 * @param {*} appServiceStopStopTimes
	 * @param {*} app_job_group_id2
	 * @param {*} service_leg_addr_st_num
	 * @param {*} service_leg_addr_suburb
	 * @param {*} service_leg_addr_state
	 * @param {*} service_leg_addr_postcode
	 * @param {*} service_leg_addr_lat
	 * @param {*} service_leg_addr_lon
	 * @param {*} appServiceStopFranchisee
	 * @param {*} appServiceStopNotes
	 * @param {*} appServiceStopRunPlan
	 * @param {*} appServiceStopAddressType
	 * @param {*} appServiceStopFreq
	 * @param {*} appServiceStopCustomerText
	 */
	function createAppJobs(
		appServiceStopCustomer,
		appServiceStopStopName,
		appServiceStopService,
		appServiceStopStopTimes,
		app_job_group_id2,
		service_leg_addr_st_num,
		service_leg_addr_suburb,
		service_leg_addr_state,
		service_leg_addr_postcode,
		service_leg_addr_lat,
		service_leg_addr_lon,
		appServiceStopFranchisee,
		appServiceStopNotes,
		appServiceStopRunPlan,
		appServiceStopAddressType,
		appServiceStopFreq,
		appServiceStopCustomerText,
		app_job_group_name,
		netsuiteDateFormat,
		dateDDMMYYYY,
		serviceLeg,
		contactFName,
		contactLName,
		contactEmail,
		contactPhone,
		lpoServiceDate,
		stopNamePreCreated,
		lpoLinkedZeesOperators
	) {
		log.debug({
			title: "createAppJobs",
			details: "Creating App Job for " + stopNamePreCreated
		});

		log.debug({
			title: "appServiceStopAddressType",
			details: appServiceStopAddressType
		});
		log.debug({
			title: "serviceLeg",
			details: serviceLeg
		});
		var app_job_rec = record.create({
			type: "customrecord_job"
		});
		app_job_rec.setValue({
			fieldId: "custrecord_job_franchisee",
			value: appServiceStopFranchisee
		});

		log.debug({
			title: "lpoLinkedZeesOperators",
			details: "Creating App Job for " + lpoLinkedZeesOperators
		});

		var lpoLinkedZeesOperatorsArray = lpoLinkedZeesOperators;
		// var commaIndexOf = lpoLinkedZeesOperators.indexOf(',');
		// if (commaIndexOf == -1) {
		//     lpoLinkedZeesOperatorsArray.push(lpoLinkedZeesOperators)
		// } else {
		//     lpoLinkedZeesOperatorsArray = lpoLinkedZeesOperators.split(',')
		// }

		log.debug({
			title: "lpoLinkedZeesOperatorsArray",
			details: "Creating App Job for " + lpoLinkedZeesOperatorsArray
		});

		// var frequencyArray = appServiceStopFreq.split(",");
		var app_job_stop_name = "";

		//1,1,1,1,1,0
		if (appServiceStopFreq == "adhoc") {
			// if (appServiceStopAddressType == 3) {
			//     app_job_rec.setValue({
			//         fieldId: "custrecord_app_job_stop_name",
			//         value:
			//             "ADHOC - " +
			//             appServiceStopStopName +
			//             " - " +
			//             appServiceStopCustomerText,
			//     });
			//     app_job_stop_name =
			//         "ADHOC - " +
			//         appServiceStopStopName +
			//         " - " +
			//         appServiceStopCustomerText;
			// } else {
			//     app_job_rec.setValue({
			//         fieldId: "custrecord_app_job_stop_name",
			//         value: "ADHOC - " + appServiceStopStopName,
			//     });
			//     app_job_stop_name = "ADHOC - " + appServiceStopStopName;
			// }

			app_job_rec.setValue({
				fieldId: "custrecord_app_job_stop_name",
				value: stopNamePreCreated
			});
		}

		log.debug({
			title: "stopNamePreCreated",
			details: stopNamePreCreated
		});

		app_job_rec.setValue({
			fieldId: "custrecord_job_service_leg",
			value: serviceLeg
		});
		app_job_rec.setValue({
			fieldId: "custrecord_job_customer",
			value: appServiceStopCustomer
		});
		app_job_rec.setValue({
			fieldId: "custrecord_job_source",
			value: 6
		});
		app_job_rec.setValue({
			fieldId: "custrecord_job_service",
			value: appServiceStopService
		});

		//Get the service price from the service record
		var serviceRecord = record.load({
			type: "customrecord_service",
			id: appServiceStopService
		});

		var servicePrice = serviceRecord.getValue({
			fieldId: "custrecord_service_price"
		});

		app_job_rec.setValue({
			fieldId: "custrecord_job_service_price",
			value: servicePrice
		});

		app_job_rec.setValue({
			fieldId: "custrecord_job_group",
			value: app_job_group_id2
		});

		app_job_rec.setValue({
			fieldId: "custrecord_app_job_st_name_no",
			value: service_leg_addr_st_num
		});
		app_job_rec.setValue({
			fieldId: "custrecord_app_job_suburb",
			value: service_leg_addr_suburb
		});
		app_job_rec.setValue({
			fieldId: "custrecord_app_job_state",
			value: service_leg_addr_state
		});
		app_job_rec.setValue({
			fieldId: "custrecord_app_job_post_code",
			value: service_leg_addr_postcode
		});
		app_job_rec.setValue({
			fieldId: "custrecord_app_job_lat",
			value: service_leg_addr_lat
		});
		app_job_rec.setValue({
			fieldId: "custrecord_app_job_lon",
			value: service_leg_addr_lon
		});

		app_job_rec.setValue({
			fieldId: "custrecord_app_job_notes",
			value: appServiceStopNotes
		});
		// app_job_rec.setValue({
		//     fieldId: "custrecord_app_job_run",
		//     value: appServiceStopRunPlan[0],
		// });

		var app_job_location_type_name = "";
		if (appServiceStopAddressType == 3) {
			app_job_rec.setValue({
				fieldId: "custrecord_app_job_location_type",
				value: 2
			});
			app_job_location_type_name = "Non-Customer";
		} else {
			app_job_rec.setValue({
				fieldId: "custrecord_app_job_location_type",
				value: 1
			});
			app_job_location_type_name = "Customer";
		}

		//08:50|300000,08:50|300000,08:50|300000,08:50|300000,08:50|300000,08:50|300000
		// var stopTimesArray = appServiceStopStopTimes.split(",");
		// var serviceTime = stopTimesArray[day].split("|");

		log.debug({
			title: "appServiceStopStopTimes",
			details: appServiceStopStopTimes
		});

		var oneHourAdded = addOneHour12Hour(appServiceStopStopTimes);
		oneHourAdded = convertTo24Hour(oneHourAdded);
		log.debug({
			title: "oneHourAdded",
			details: oneHourAdded
		});

		var timePart = oneHourAdded.split(":");
		log.debug({
			title: "dateDDMMYYYY",
			details: dateDDMMYYYY
		});
		log.debug({
			title: "timePart",
			details: timePart
		});
		var nsScheduledTime = new Date(dateDDMMYYYY);
		log.debug({
			title: "nsScheduledTime",
			details: nsScheduledTime
		});
		nsScheduledTime.setHours(timePart[0], timePart[1], 0, 0);
		log.debug({
			title: "nsScheduledTime",
			details: nsScheduledTime
		});

		app_job_rec.setValue({
			fieldId: "custrecord_job_time_scheduled",
			value: nsScheduledTime
		});

		app_job_rec.setValue({
			fieldId: "custrecord_job_date_scheduled",
			value: netsuiteDateFormat
		});
		app_job_rec.setValue({
			fieldId: "custrecord_job_status",
			value: 1
		});

		app_job_rec.setValue({
			fieldId: "custrecord_app_job_contact_fname",
			value: contactFName
		});
		app_job_rec.setValue({
			fieldId: "custrecord_app_job_contact_lname",
			value: contactLName
		});
		app_job_rec.setValue({
			fieldId: "custrecord_app_job_contact_email",
			value: contactEmail
		});
		app_job_rec.setValue({
			fieldId: "custrecord_app_job_contact_phone",
			value: contactPhone
		});

		var app_job_id = app_job_rec.save();

		var apiURL = "https://app.mailplus.com.au/api/v1/general/ns_jobs";
		// var apiURL = 'https://stageapp.mailplus.com.au/api/v1/general/ns_jobs' // Staging Environment
		var apiBody = '{"jobs": [{';
		// if (isSameDay == false || isSameDay == 'false') {
		// apiURL += "?run=false";
		// apiBody += '"date": "' + convertDateToDDMMYYYYDash(lpoServiceDate) + '",';
		// } else {
		apiURL += "?run=true";
		// }

		apiBody += '"ns_id": "' + app_job_id + '",';
		apiBody += '"e_id": "' + app_job_id + '",';
		apiBody += '"lpo": "true",';
		apiBody += '"customer_ns_id": "' + appServiceStopCustomer + '",';
		apiBody += '"time_scheduled": "' + appServiceStopStopTimes + '",';
		apiBody +=
			'"scheduled_before": "' +
			subtractOneHour12Hour(appServiceStopStopTimes) +
			'",';
		apiBody +=
			'"scheduled_after": "' + addOneHour12Hour(appServiceStopStopTimes) + '",';
		apiBody += '"location_type": "' + app_job_location_type_name + '",';
		apiBody += '"note": "' + appServiceStopNotes + '",';

		apiBody += '"operator_ns_ids": [';
		for (var x = 0; x < lpoLinkedZeesOperatorsArray.length; x++) {
			apiBody += '"' + lpoLinkedZeesOperatorsArray[x].toString() + '"';
			if (x < lpoLinkedZeesOperatorsArray.length - 1) {
				apiBody += ",";
			}
		}

		apiBody += "],";

		apiBody += '"stop_name": "' + stopNamePreCreated + '",';
		apiBody += '"address": {';
		apiBody += '"address1": "' + service_leg_addr_st_num + '",';
		apiBody += '"suburb": "' + service_leg_addr_suburb + '",';
		apiBody += '"state": "' + service_leg_addr_state + '",';
		apiBody += '"postcode": "' + service_leg_addr_postcode + '",';
		apiBody += '"lat": "' + service_leg_addr_lat + '",';
		apiBody += '"lon": "' + service_leg_addr_lon + '"';
		apiBody += "},";
		apiBody += '"job_group": {';
		apiBody += '"ns_id": "' + app_job_group_id2 + '",';
		apiBody += '"name": "' + app_job_group_name + '",';
		apiBody += '"status": "Scheduled"';
		apiBody += "}";
		apiBody += "}]}";

		log.debug({
			title: "apiURL",
			details: apiURL
		});
		log.debug({
			title: "apiHeaders",
			details: apiHeaders
		});
		log.debug({
			title: "apiBody",
			details: apiBody
		});

		// try {
		var apiResponse = https.post({
			url: apiURL,
			body: apiBody,
			headers: apiHeaders
		});
		var parsedAPIResponseBody = JSON.parse(apiResponse.body);
		// } catch (error) {
		//     if (error.name == "SSS_REQUEST_TIME_EXCEEDED") {
		//         var apiResponse = https.post({
		//             url: apiURL,
		//             body: apiBody,
		//             headers: apiHeaders,
		//         });
		//         var parsedAPIResponseBody = JSON.parse(apiResponse.body);
		//     }
		// }

		log.debug({
			title: "parsedAPIResponseBody",
			details: parsedAPIResponseBody
		});

		return app_job_id;
	}

	/**
	 * @description Gets yesterday's date in "YYYY-MM-DD" format.
	 * @returns {String} Yesterday's date in "YYYY-MM-DD" format.
	 */
	function getTomorrowsDate() {
		var today = new Date();
		today.setHours(today.getHours() + 10);
		// var timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

		log.audit({
			title: "today",
			details: today
		});
		log.audit({
			title: "today.getDate()",
			details: today.getDate()
		});

		var year = today.getFullYear();
		var month = customPadStart((today.getMonth() + 1).toString(), 2, "0"); // Months are zero-based
		var day = customPadStart(today.getDate() + 1, 2, "0");

		return year + "-" + month + "-" + day;
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

	function extractKeyValuePairs(obj, prefix, result) {
		prefix = prefix || "";
		result = result || {};
		for (var key in obj) {
			if (!obj.hasOwnProperty(key)) continue;
			var value = obj[key];
			if (value && typeof value === "object") {
				if ("stringValue" in value) {
					result[prefix + key] = value.stringValue;
				} else if ("integerValue" in value) {
					result[prefix + key] = value.integerValue;
				} else if ("booleanValue" in value) {
					result[prefix + key] = value.booleanValue;
				} else if ("timestampValue" in value) {
					result[prefix + key] = value.timestampValue;
				} else if ("nullValue" in value) {
					result[prefix + key] = null;
				} else if ("arrayValue" in value) {
					var arr = value.arrayValue.values || [];
					for (var i = 0; i < arr.length; i++) {
						extractKeyValuePairs(arr[i], prefix + key + "[" + i + "].", result);
					}
				} else if ("mapValue" in value) {
					extractKeyValuePairs(
						value.mapValue.fields,
						prefix + key + ".",
						result
					);
				} else {
					extractKeyValuePairs(value, prefix + key + ".", result);
				}
			} else {
				result[prefix + key] = value;
			}
		}
		return result;
	}

	/**
	 * @description Gets yesterday's date in "YYYY-MM-DD" format.
	 * @returns {String} Yesterday's date in "YYYY-MM-DD" format.
	 */
	function getTodaysDate() {
		var now = new Date();
		var todayDate;
		var todayTime;

		if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
			var sydneyFormatter = new Intl.DateTimeFormat("en-CA", {
				timeZone: "Australia/Sydney",
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				hour12: false
			});

			var sydneyDateTime = sydneyFormatter.format(now).split(", ");
			todayDate = sydneyDateTime[0];
			todayTime = sydneyDateTime[1];
		} else {
			// Fallback for environments without Intl support.
			var fallbackDate = new Date(now.getTime() + 10 * 60 * 60 * 1000);
			var year = fallbackDate.getUTCFullYear();
			var month = customPadStart(
				(fallbackDate.getUTCMonth() + 1).toString(),
				2,
				"0"
			);
			var day = customPadStart(fallbackDate.getUTCDate(), 2, "0");
			var hours = customPadStart(fallbackDate.getUTCHours(), 2, "0");
			var minutes = customPadStart(fallbackDate.getUTCMinutes(), 2, "0");
			var seconds = customPadStart(fallbackDate.getUTCSeconds(), 2, "0");

			todayDate = year + "-" + month + "-" + day;
			todayTime = hours + ":" + minutes + ":" + seconds;
		}

		log.audit({
			title: "today (Australia/Sydney)",
			details: todayDate + " " + todayTime
		});

		return todayDate;
	}

	/**
	 * @description
	 * @author Ankith Ravindran (AR)
	 * @date 02/05/2024
	 * @param {*} date_selected
	 * @returns {*}
	 */
	function dateSelected2Date(date_selected) {
		// date_selected = "2020-06-04"
		var date_array = date_selected.split("-");
		// date_array = ["2020", "06", "04"]
		var year = date_array[0];
		var month = date_array[1] - 1;
		var day = date_array[2];
		var date = new Date(year, month, day);
		return date;
	}

	function convertDateToDDMMYYYYDash(dateStr) {
		// Expects dateStr in "YYYY-MM-DD"
		var parts = dateStr.split("-");
		return parts[2] + "-" + parts[1] + "-" + parts[0];
	}

	function convertDateToDDMMYYYY(dateStr) {
		// Expects dateStr in "YYYY-MM-DD"
		var parts = dateStr.split("-");
		return parts[2] + "/" + parts[1] + "/" + parts[0];
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

	function convertTo24Hour(time) {
		// nlapiLogExecution('DEBUG', 'time', time);
		var hours = parseInt(time.substr(0, 2));
		if (time.indexOf("AM") != -1 && hours == 12) {
			time = time.replace("12", "0");
		}
		if (time.indexOf("AM") != -1 && hours < 10) {
			time = time.replace(hours, "0" + hours);
		}
		if (time.indexOf("PM") != -1 && hours < 12) {
			time = time.replace(hours, hours + 12);
		}
		return time.replace(/( AM| PM)/, "");
	}

	function addOneHour12Hour(timeStr) {
		// Expects timeStr in "3:00 PM" format
		var parts = timeStr.split(" ");
		var time = parts[0];
		var ampm = parts[1];
		var timeParts = time.split(":");
		var hours = parseInt(timeParts[0], 10);
		var minutes = parseInt(timeParts[1], 10);

		if (ampm === "PM" && hours !== 12) hours += 12;
		if (ampm === "AM" && hours === 12) hours = 0;

		var date = new Date(2000, 0, 1, hours, minutes);
		date.setHours(date.getHours() + 1);

		var newHours = date.getHours();
		var newAmpm = newHours >= 12 ? "PM" : "AM";
		var displayHour = newHours % 12;
		displayHour = displayHour ? displayHour : 12;
		var displayMinutes = date.getMinutes().toString();
		displayMinutes = customPadStart(displayMinutes, 2, "0");

		return displayHour + ":" + displayMinutes + " " + newAmpm;
	}

	function subtractOneHour12Hour(timeStr) {
		// Expects timeStr in "3:00 PM" format
		var parts = timeStr.split(" ");
		var time = parts[0];
		var ampm = parts[1];
		var timeParts = time.split(":");
		var hours = parseInt(timeParts[0], 10);
		var minutes = parseInt(timeParts[1], 10);

		if (ampm === "PM" && hours !== 12) hours += 12;
		if (ampm === "AM" && hours === 12) hours = 0;

		var date = new Date(2000, 0, 1, hours, minutes);
		date.setHours(date.getHours() - 1);

		var newHours = date.getHours();
		var newAmpm = newHours >= 12 ? "PM" : "AM";
		var displayHour = newHours % 12;
		displayHour = displayHour ? displayHour : 12;
		var displayMinutes = date.getMinutes().toString();
		displayMinutes = customPadStart(displayMinutes, 2, "0");

		return displayHour + ":" + displayMinutes + " " + newAmpm;
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
