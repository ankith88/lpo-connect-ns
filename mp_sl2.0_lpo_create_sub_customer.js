/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet

 * Author:               Ankith Ravindran
 * Created on:           Tue Apr 21 2026
 * Modified on:          Tue Apr 21 2026 07:48:36
 * SuiteScript Version:  2.0 
 * Description:          Create Sub Customer Record for LPO Lead Generation and link to Parent LPO Customer 
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
	"N/format",
	"N/https",
	"N/crypto",
	"N/encode",
	"N/url"
], function (
	ui,
	email,
	runtime,
	search,
	record,
	http,
	log,
	redirect,
	format,
	https,
	crypto,
	encode,
	url
) {
	var role = 0;
	var userId = 0;
	var zeeId;
	var zeeCount = 0;

	var todayDateYYYYMMDD = null;
	var tomorrowDateYYYYMMDD = null;

	var apiHeaders = {};
	apiHeaders["Content-Type"] = "application/json";
	apiHeaders["Accept"] = "application/json";
	apiHeaders["GENERAL-API-KEY"] = "708aa067-d67d-73e6-8967-66786247f5d7";

	var lpoParentLPOSubCaustomerforAdhocBookingInternalId = null;
	var lpoParentLPOCustomerInternalID = null;
	var adhocBookingURL = null;
	var lpoLeadProfileInternalId = null;

	var lpoAddress1 = null;
	var lpoAddress2 = null;
	var lpoCity = null;
	var lpoState = null;
	var lpoZip = null;
	var lpoContactName = null;
	var lpoContactEmail = null;
	var lpoContactPhone = null;

	var date = new Date();
	var date_now = format.parse({
		value: date,
		type: format.Type.DATE
	});
	var time_now = format.parse({
		value: date,
		type: format.Type.TIMEOFDAY
	});

	function onRequest(context) {
		var baseURL = "https://system.na2.netsuite.com";
		if (runtime.EnvType == "SANDBOX") {
			baseURL = "https://system.sandbox.netsuite.com";
		}
		userId = 1822062;
		role = 1005;
		var invoicingMethod = [
			"Full Payment Customer",
			"Split Payment LPO & Customer",
			"Full Payment LPO"
		];
		// todayDateYYYYMMDD = getTodaysDate();
		// tomorrowDateYYYYMMDD = getTomorrowsDate();

		if (context.request.method === "GET") {
			log.audit({
				title: "Received Request",
				details: JSON.stringify(context.request)
			});
			log.audit({
				title: "Received Parameters",
				details: JSON.stringify(context.request.parameters)
			});

			//{"lastName":"Ravindran","address":"1 Kingfield Road","lng":"150.9582444","lpo_id":"1974139","postcode":"2155","script":"2527","deploy":"1","billing":"lpo","frequency":"Mon,Wed,Thu,Fri,Tue","firstName":"Ankith","preferredTime":"14:30","compid":"1048144","phone":"0402712233","service":"lpo-to-site","ns-at":"AAEJ7tMQJX8dMLsjS5TGMacB9-M8pUB6q50I_ptxbLYqKZ_HR3c","suburb":"North Kellyville","company":"Bruce Wayne","state":"NSW","jobType":"scheduled","email":"ankith.ravindran@gmail.com","lat":"-33.691453","startDate":"2026-04-21"}

			//Adhoc Job Booking Parameters
			//{"lastName":"Ravindran","address":"1 Kingfield Road","lng":"150.9582444","lpo_id":"1974139","postcode":"2155","script":"2527","deploy":"1","billing":"lpo","frequency":"","firstName":"Ankith","preferredTime":"14:30","compid":"1048144","phone":"0402712233","service":"lpo-to-site","ns-at":"AAEJ7tMQJX8dMLsjS5TGMacB9-M8pUB6q50I_ptxbLYqKZ_HR3c","suburb":"North Kellyville","company":"Bruce Wayne","state":"NSW","jobType":"one-off","email":"ankith.ravindran@gmail.com","lat":"-33.691453","startDate":"2026-04-21"}

			var parent_lpo = context.request.parameters.lpo_id;
			var business_name = context.request.parameters.company;
			var first_name = context.request.parameters.firstName;
			var last_name = context.request.parameters.lastName;
			var contact_email = context.request.parameters.email;
			var phone_number = context.request.parameters.phone;
			var address2 = context.request.parameters.address1;
			var address1 = context.request.parameters.address;
			var city = context.request.parameters.suburb;
			var state = context.request.parameters.state;
			var postcode = context.request.parameters.postcode;
			var lat = context.request.parameters.lat;
			var lng = context.request.parameters.lng;
			var lpo_notes = context.request.parameters.lpo_notes;
			var lpoNewcustomerServiceType = context.request.parameters.jobType;
			var billing = context.request.parameters.billing;
			var lead_selected_service_text = context.request.parameters.service_name;
			var lead_service_date = context.request.parameters.startDate;

			var lead_service_date = null;
			if (lpoNewcustomerServiceType == "scheduled") {
				var lead_service_freq = context.request.parameters.frequency;
			} else {
				var lead_service_freq = null;
			}

			var leadRecord = record.load({
				type: "customer",
				id: parseInt(parent_lpo)
			});
			var lpoName = leadRecord.getValue({
				fieldId: "companyname"
			});
			var parentLPOEmail = leadRecord.getValue({
				fieldId: "email"
			});
			var lpoLinkedZees = leadRecord.getValue({
				fieldId: "custentity_lpo_linked_franchisees"
			});
			var lpoNameArray = lpoName.split(" - ");
			lpoName = lpoNameArray[0].trim();

			//NetSuite Search: LPO Lead Profiles - List
			var lpoLeadsProfileListSearch = search.load({
				id: "customsearch_lpo_lead_profiles_list",
				type: "customrecord_lpo_lead_form"
			});

			lpoLeadsProfileListSearch.filters.push(
				search.createFilter({
					name: "internalid",
					join: "CUSTRECORD_LPO_LEAD_CUSTOMER",
					operator: search.Operator.ANYOF,
					values: parent_lpo
				})
			);

			var linkNCLInternalID = null;
			lpoLeadsProfileListSearch
				.run()
				.each(function (lpoLeadsProfileListSearchResultSet) {
					linkNCLInternalID = lpoLeadsProfileListSearchResultSet.getValue({
						name: "custrecord_ncl_link"
					});

					return true;
				});

			var lpoLinkedZeesArray = [];
			if (!isNullorEmpty(lpoLinkedZees)) {
				lpoLinkedZees = lpoLinkedZees.toString();
				log.debug({
					title: "lpoLinkedZees",
					details: lpoLinkedZees
				});
				if (lpoLinkedZees.indexOf(",") != -1) {
					lpoLinkedZeesArray = lpoLinkedZees.split(",");
				} else {
					lpoLinkedZeesArray = [];
					lpoLinkedZeesArray.push(lpoLinkedZees);
				}
			}
			log.debug({
				title: "lpoLinkedZeesArray",
				details: lpoLinkedZeesArray
			});

			var activeOperator = [];
			var lpoSuburbMappingJSON = [];
			var finalZeeIDArray = [];
			var lpoLinkedZeeTextArray = [];
			var linkedZeeDetails = '"linkedZeeDetails": {"arrayValue": { "values": [';
			for (var x = 0; x < lpoLinkedZeesArray.length; x++) {
				var partnerRecord = record.load({
					type: record.Type.PARTNER,
					id: lpoLinkedZeesArray[x]
				});

				var zeeJSONString = partnerRecord.getValue({
					fieldId: "custentity_ap_suburbs_json"
				});
				var zeeName = partnerRecord.getValue({
					fieldId: "companyname"
				});

				var mainContactName = partnerRecord.getValue({
					fieldId: "custentity3"
				});
				var partnerPhone = partnerRecord.getValue({
					fieldId: "custentity2"
				});
				var partnerEmail = partnerRecord.getValue({
					fieldId: "email"
				});

				partnerPhone = partnerPhone.replace(/ /g, "");
				partnerPhone = partnerPhone.slice(1);
				partnerPhone = "+61" + partnerPhone;

				log.audit({
					title: "zeeJSONString",
					details: zeeJSONString
				});

				var zeeJSON = JSON.parse(zeeJSONString);

				log.audit({
					title: "zeeJSON",
					details: zeeJSON
				});
				log.audit({
					title: "city",
					details: city
				});
				log.audit({
					title: "state",
					details: state
				});
				log.audit({
					title: "postcode",
					details: postcode
				});

				var suburbStatePostcodeExistsReturn = suburbStatePostcodeExists(
					zeeJSON,
					city,
					state,
					postcode
				);

				log.audit({
					title: "suburbStatePostcodeExistsReturn",
					details: suburbStatePostcodeExistsReturn
				});

				if (suburbStatePostcodeExistsReturn) {
					finalZeeIDArray.push(lpoLinkedZeesArray[x]);
					lpoLinkedZeeTextArray.push(zeeName);
					var zeeContactString =
						mainContactName + "," + partnerEmail + "," + partnerPhone;
					linkedZeeDetails += '{"stringValue": "' + zeeContactString + '"},';
					log.debug({
						title: "zeeContactString",
						details: zeeContactString
					});
					zeeJSON.forEach(function (suburb) {
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
					});
				}

				log.audit({
					title: "activeOperator",
					details: activeOperator
				});
				log.audit({
					title: "finalZeeIDArray",
					details: finalZeeIDArray
				});
			}
			//remove thee last character if it is a comma
			if (linkedZeeDetails.slice(-1) == ",") {
				linkedZeeDetails = linkedZeeDetails.slice(0, -1);
			}
			linkedZeeDetails += "]}}";

			activeOperator = removeDuplicates(activeOperator);

			log.audit({
				title: "activeOperator",
				details: activeOperator
			});
			log.audit({
				title: "finalZeeIDArray",
				details: finalZeeIDArray
			});
			log.audit({
				title: "lpoLinkedZeeTextArray",
				details: lpoLinkedZeeTextArray
			});

			serviceDateEffective = getDateStoreNS();

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

			// //CREATE THE MAIN CUSTOMER RECORD LINKED WITH THE PARENT LPO AND ASSIGNED TO MAILPLUS PTY LTD FRANCHISEE
			if (billing == "lpo") {
				var lpoMainSubCustomer = record.create({
					type: record.Type.CUSTOMER,
					isDynamic: true
				});
			} else if (billing == "customer") {
				var lpoMainSubCustomer = record.create({
					type: record.Type.PROSPECT,
					isDynamic: true
				});
			}
			lpoMainSubCustomer.setValue({
				fieldId: "parent",
				value: parent_lpo
			});
			lpoMainSubCustomer.setValue({
				fieldId: "custentity_lpo_parent_account",
				value: parent_lpo
			});

			if (billing == "lpo") {
				lpoMainSubCustomer.setValue({
					fieldId: "companyname",
					value: "LPO - " + business_name + " - Parent"
				});

				lpoMainSubCustomer.setValue({
					fieldId: "custentity_invoice_by_email",
					value: false
				});
				lpoMainSubCustomer.setValue({
					fieldId: "custentity18",
					value: true
				});
				lpoMainSubCustomer.setValue({
					fieldId: "custentity_exclude_debtor",
					value: true
				});
				lpoMainSubCustomer.setValue({
					fieldId: "custentity_fin_consolidated",
					value: true
				});
				lpoMainSubCustomer.setValue({
					fieldId: "custentity_invoice_method",
					value: 10
				});
				lpoMainSubCustomer.setValue({
					fieldId: "custentity_lpo_invoice_payment",
					value: invoicingMethod[2]
				});
				lpoMainSubCustomer.setValue({
					fieldId: "email",
					value: parentLPOEmail
				});
				lpoMainSubCustomer.setValue({
					fieldId: "custentity_email_service",
					value: parentLPOEmail
				});
				lpoMainSubCustomer.setValue({
					fieldId: "custentity_email_sales",
					value: parentLPOEmail
				});
			} else if (billing == "customer") {
				lpoMainSubCustomer.setValue({
					fieldId: "companyname",
					value: business_name + " - Parent"
				});
				lpoMainSubCustomer.setValue({
					fieldId: "custentity_lpo_invoice_payment",
					value: invoicingMethod[0]
				});

				lpoMainSubCustomer.setValue({
					fieldId: "custentity_invoice_by_email",
					value: true
				});
				lpoMainSubCustomer.setValue({
					fieldId: "custentity18",
					value: true
				});
				lpoMainSubCustomer.setValue({
					fieldId: "custentity_invoice_method",
					value: 2
				});
				lpoMainSubCustomer.setValue({
					fieldId: "email",
					value: contact_email
				});
				lpoMainSubCustomer.setValue({
					fieldId: "custentity_email_service",
					value: contact_email
				});
				lpoMainSubCustomer.setValue({
					fieldId: "custentity_email_sales",
					value: contact_email
				});
			}

			lpoMainSubCustomer.setValue({
				fieldId: "partner",
				value: 435 //MailPlus Pty Ltd
			});

			lpoMainSubCustomer.setValue({
				fieldId: "phone",
				value: phone_number
			});
			lpoMainSubCustomer.setValue({
				fieldId: "leadsource",
				value: 282083 //LPO - AP Customer
			});

			if (billing == "customer") {
				lpoMainSubCustomer.setValue({
					fieldId: "entitystatus",
					value: 81 //PROSPECT - LPO OPPORTUNITY
				});
			} else if (billing == "lpo") {
				lpoMainSubCustomer.setValue({
					fieldId: "entitystatus",
					value: 80 //CUSTOMER - LPO SIGNED
				});
			}

			lpoMainSubCustomer.setValue({
				fieldId: "custentity_hotleads",
				value: true
			});

			lpoMainSubCustomer.setValue({
				fieldId: "custentity_industry_category",
				value: 19
			});
			lpoMainSubCustomer.setValue({
				fieldId: "custentity_date_lead_entered",
				value: getDate()
			});
			lpoMainSubCustomer.setValue({
				fieldId: "custentity_lead_entered_by",
				value: 585236
			});
			lpoMainSubCustomer.setValue({
				fieldId: "custentity_mpex_invoicing_cycle",
				value: 2
			});
			lpoMainSubCustomer.setValue({
				fieldId: "custentity_lpo_account_status",
				value: 2
			});
			lpoMainSubCustomer.setValue({
				fieldId: "custentity_date_lpo_validated",
				value: getDate()
			});
			lpoMainSubCustomer.setValue({
				fieldId: "custentity_service_fuel_surcharge",
				value: 2
			});
			lpoMainSubCustomer.setValue({
				fieldId: "custentity_mpex_surcharge",
				value: 1
			});
			// lpoMainSubCustomer.setValue({
			//     fieldId: "custentity_mp_toll_salesrep",
			//     value: leadSalesRepAssigned
			// });

			if (billing == "lpo") {
				lpoMainSubCustomer.setValue({
					fieldId: "custentity_terms_conditions_agree_date",
					value: getDate()
				});
				lpoMainSubCustomer.setValue({
					fieldId: "custentity_cust_closed_won",
					value: true
				});
				lpoMainSubCustomer.setValue({
					fieldId: "custentity_date_prospect_opportunity",
					value: getDate()
				});
				lpoMainSubCustomer.setValue({
					fieldId: "custentity_terms_conditions_agree",
					value: 1
				});
			}

			lpoMainSubCustomer.setValue({
				fieldId: "custentity_lpo_linked_franchisees",
				value: finalZeeIDArray
			});
			//CREATE ADDRESS FOR PARENT LPO CUSTOMER
			lpoMainSubCustomer.selectNewLine({
				sublistId: "addressbook"
			});
			lpoMainSubCustomer.setCurrentSublistValue({
				sublistId: "addressbook",
				fieldId: "label",
				value: "Site Address"
			});
			var addressSubrecord = lpoMainSubCustomer.getCurrentSublistSubrecord({
				sublistId: "addressbook",
				fieldId: "addressbookaddress"
			});

			// Set values on the subrecord.
			// Set country field first when script uses dynamic mode
			addressSubrecord.setValue({
				fieldId: "country",
				value: "AU"
			});

			addressSubrecord.setValue({
				fieldId: "internalid",
				value: 1
			});

			addressSubrecord.setValue({
				fieldId: "city",
				value: city
			});

			addressSubrecord.setValue({
				fieldId: "state",
				value: state
			});

			addressSubrecord.setValue({
				fieldId: "zip",
				value: postcode
			});

			addressSubrecord.setValue({
				fieldId: "addr1",
				value: address1
			});
			addressSubrecord.setValue({
				fieldId: "addr2",
				value: address2
			});
			addressSubrecord.setValue({
				fieldId: "custrecord_address_lat",
				value: lat
			});
			addressSubrecord.setValue({
				fieldId: "custrecord_address_lon",
				value: lng
			});

			addressSubrecord.setValue({
				fieldId: "defaultshipping",
				value: true
			});
			addressSubrecord.setValue({
				fieldId: "defaultbilling",
				value: true
			});
			addressSubrecord.setValue({
				fieldId: "isresidential",
				value: false
			});
			addressSubrecord.setValue({
				fieldId: "addressee",
				value: business_name
			});

			lpoMainSubCustomer.commitLine({
				sublistId: "addressbook"
			});

			var lpoMainSubCustomerInternalID = lpoMainSubCustomer.save();

			log.audit({
				title: "LPO Main Sub Customer Internal ID created",
				details: lpoMainSubCustomerInternalID
			});

			//CREATE CONTACT FOR THE REFERALL LEAD
			var contactRecord = record.create({
				type: record.Type.CONTACT
			});

			contactRecord.setValue({
				fieldId: "company",
				value: lpoMainSubCustomerInternalID
			});
			contactRecord.setValue({
				fieldId: "firstname",
				value: first_name
			});
			contactRecord.setValue({
				fieldId: "lastname",
				value: last_name
			});
			contactRecord.setValue({
				fieldId: "entityid",
				value: first_name + " " + last_name
			});
			contactRecord.setValue({
				fieldId: "email",
				value: contact_email
			});
			contactRecord.setValue({
				fieldId: "phone",
				value: phone_number
			});
			contactRecord.setValue({ fieldId: "contactrole", value: -10 });

			var contactId = contactRecord.save({ ignoreMandatoryFields: true });

			if (!isNullorEmpty(lpo_notes)) {
				//CREATE USER NOTE
				var userNoteRecord = record.create({
					type: record.Type.NOTE,
					isDynamic: true
				});

				userNoteRecord.setValue({
					fieldId: "entity",
					value: parseInt(lpoMainSubCustomerInternalID)
				});

				userNoteRecord.setValue({
					fieldId: "title",
					value: "LPO Referral - New Lead"
				});

				userNoteRecord.setValue({
					fieldId: "direction",
					value: 1
				});

				userNoteRecord.setValue({
					fieldId: "notetype",
					value: 7
				});

				userNoteRecord.setValue({
					fieldId: "author",
					value: userId
				});

				userNoteRecord.setValue({
					fieldId: "notedate",
					value: getDate()
				});

				userNoteRecord.setValue({
					fieldId: "note",
					value: lpo_notes
				});

				var userNoteRecordId = userNoteRecord.save();
			}

			//CREATE SALES RECORD
			var recSales = record.create({
				type: "customrecord_sales"
			});
			recSales.setValue({
				fieldId: "custrecord_sales_customer",
				value: lpoMainSubCustomerInternalID
			});
			recSales.setValue({
				fieldId: "custrecord_sales_outcome",
				value: 5
			});
			recSales.setValue({
				fieldId: "custrecord_sales_callbackdate",
				value: getDate()
			});
			recSales.setValue({
				fieldId: "custrecord_sales_callbacktime",
				value: time_now
			});
			recSales.setValue({
				fieldId: "custrecord_sales_campaign",
				value: 69 //LPO campaign
			});
			var lpoMainSubCustomerSalesRecordInternalId = recSales.save({
				ignoreMandatoryFields: true
			});

			/**
			 *  customerRecord.setValue({fieldId: 'custentity_service_fuel_surcharge', value: 1});
			 */

			var leadSalesReppToAssignJSON = {
				customerId: parseInt(lpoMainSubCustomerInternalID),
				salesRecordId: parseInt(lpoMainSubCustomerSalesRecordInternalId)
			};

			//!Call Tim's script to assign the lead to a sales rep randomly.
			var leadSalesRepAssignedJSON = https.get({
				url:
					"https://1048144.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=2160&deploy=2&compid=1048144&ns-at=AAEJ7tMQ3VfSfXZtokK6wuyERCw4vIJ8YBmkKwc8nxv2kzikwgg&operation=assignCustomerToSalesRepsWithLeastLeads&requestParams=" +
					JSON.stringify(leadSalesReppToAssignJSON),
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json"
				}
			});

			leadSalesRepAssignedJSON = JSON.parse(leadSalesRepAssignedJSON.body);

			log.audit({
				title: "Lead Sales Rep Assigned JSON",
				details: leadSalesRepAssignedJSON
			});

			leadSalesRepAssigned = leadSalesRepAssignedJSON.internalid;
			var leadSalesRepAssignedName = leadSalesRepAssignedJSON.entityid;
			var leadSalesRepAssignedEmail = leadSalesRepAssignedJSON.email;

			log.audit({
				title: "Lead Sales Rep Assigned",
				details: leadSalesRepAssigned
			});

			//Update the Customer/Lead Record with the assigned sales rep
			var updateCustomerRecord = record.load({
				type: record.Type.PROSPECT,
				id: lpoMainSubCustomerInternalID
			});
			var entity_id = updateCustomerRecord.getValue({ fieldId: "entityid" });
			var customer_name = updateCustomerRecord.getValue({
				fieldId: "companyname"
			});
			var cust_id_link =
				baseURL +
				"/app/common/entity/custjob.nl?id=" +
				lpoMainSubCustomerInternalID;

			updateCustomerRecord.setValue({
				fieldId: "custentity_mp_toll_salesrep",
				value: parseInt(leadSalesRepAssigned)
			});
			lpoMainSubCustomerInternalID = updateCustomerRecord.save();

			//Update the Sales Record with the assigned sales rep
			var updateSalesRecord = record.load({
				type: "customrecord_sales",
				id: lpoMainSubCustomerSalesRecordInternalId
			});
			updateSalesRecord.setValue({
				fieldId: "custrecord_sales_assigned",
				value: parseInt(leadSalesRepAssigned)
			});
			lpoMainSubCustomerSalesRecordInternalId = updateSalesRecord.save();

			//CREATE COMM REG
			var customer_comm_reg = record.create({
				type: "customrecord_commencement_register",
				isDynamic: true
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_date_entry",
				value: getDateStoreNS()
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_comm_date",
				value: serviceDateEffective
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_comm_date_signup",
				value: getDateStoreNS()
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_customer",
				value: lpoMainSubCustomerInternalID
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_salesrep",
				value: userId
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_franchisee",
				value: 435 //MailPlus Pty Ltd,
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_wkly_svcs",
				value: "5"
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_in_out",
				value: 2
			}); // Inbound
			customer_comm_reg.setValue({
				fieldId: "custrecord_state",
				value: getStateId(state)
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_sale_type",
				value: 1
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_commreg_sales_record",
				value: lpoMainSubCustomerSalesRecordInternalId
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_trial_status",
				value: 2
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_tnc_agreement_date",
				value: getDateToday()
			});

			var lpoMainSubCustomerCommRegInternalId = customer_comm_reg.save();

			log.audit({
				title: "Comm Reg Record created",
				details: lpoMainSubCustomerCommRegInternalId
			});

			var mpStdActivated = 1;
			var mpExpActivated = 1;
			var mpPrmActivated = 1;
			var serviceFuelSurchargeToBeApplied = 1;

			var leadZeeAssigned = null;
			var zeeCount = lpoLinkedZeesArray.length;
			var lpoScheduledServiceCustomerInternalID = null;
			var lpoScheduledServiceCustomerEntityID = null;

			var siteAddressInternalIDForServiceStopRecord = null;
			var scheduleServiceFor = "";
			var scheduledServiceInternalId = 0;

			var localmileAMPOInternalID = null;
			var localmilePMPOInternalID = null;
			var localmileAMPOPMPOInternalID = null;
			var localmileAMPORate = 0;
			var localmilePMPORate = 0;
			var localmileAMPOPMPORate = 0;

			var localmileAdditionalBagInternalID = null;
			var localmileAdditionalBagRate = 0;

			log.audit({
				title: "finalZeeIDArray.length",
				details: finalZeeIDArray.length
			});

			// if (siteServiveable == 'true') {
			for (var fza = 0; fza < finalZeeIDArray.length; fza++) {
				log.debug({
					title: "looping through finalZeeIDArray with index: " + fza,
					details: "looping through finalZeeIDArray with index: " + fza
				});
				log.debug({
					title: "Creating Referral Lead for Zee ID: " + finalZeeIDArray[fza],
					details: "Creating Referral Lead for Zee ID: " + finalZeeIDArray[fza]
				});

				zeeId = finalZeeIDArray[fza];
				leadZeeAssigned = zeeId;

				var partnerRecord = record.load({
					type: record.Type.PARTNER,
					id: zeeId
				});
				zeeEmail = partnerRecord.getValue({
					fieldId: "email"
				});
				zeeName = partnerRecord.getValue({
					fieldId: "companyname"
				});
				mpExpActivated = partnerRecord.getValue({
					fieldId: "custentity_zee_mp_exp_activated"
				});
				mpStdActivated = partnerRecord.getValue({
					fieldId: "custentity_zee_mp_std_activated"
				});
				mpPrmActivated = partnerRecord.getValue({
					fieldId: "custentity_zee_mp_str_activated"
				});
				serviceFuelSurchargeToBeApplied = partnerRecord.getValue({
					fieldId: "custentity_service_fuel_surcharge_apply"
				});

				log.debug({
					title: "leadSalesRepAssigned",
					details: leadSalesRepAssigned
				});

				log.debug({
					title: "leadZeeAssigned",
					details: leadZeeAssigned
				});

				//CREATE THE REFERRAL LEAD RECORD
				if (billing == "customer") {
					var lpoReferralCustomerRecord = record.create({
						type: record.Type.PROSPECT,
						isDynamic: true
					});
				} else if (billing == "lpo") {
					var lpoReferralCustomerRecord = record.create({
						type: record.Type.CUSTOMER,
						isDynamic: true
					});
				}
				lpoReferralCustomerRecord.setValue({
					fieldId: "parent",
					value: lpoMainSubCustomerInternalID
				});
				// lpoReferralCustomerRecord.setValue({
				//     fieldId: "custentity_lpo_parent_account",
				//     value: lpoMainSubCustomerInternalID
				// });
				if (billing == "lpo") {
					lpoReferralCustomerRecord.setValue({
						fieldId: "companyname",
						value: "LPO - " + business_name
					});

					lpoReferralCustomerRecord.setValue({
						fieldId: "custentity_invoice_by_email",
						value: false
					});
					lpoReferralCustomerRecord.setValue({
						fieldId: "custentity18",
						value: true
					});
					lpoReferralCustomerRecord.setValue({
						fieldId: "custentity_exclude_debtor",
						value: true
					});
					lpoReferralCustomerRecord.setValue({
						fieldId: "custentity_fin_consolidated",
						value: true
					});
					lpoReferralCustomerRecord.setValue({
						fieldId: "custentity_invoice_method",
						value: 10
					});

					lpoReferralCustomerRecord.setValue({
						fieldId: "custentity_lpo_invoice_payment",
						value: invoicingMethod[2]
					});

					lpoReferralCustomerRecord.setValue({
						fieldId: "email",
						value: parentLPOEmail
					});
					lpoReferralCustomerRecord.setValue({
						fieldId: "custentity_email_service",
						value: parentLPOEmail
					});
					lpoReferralCustomerRecord.setValue({
						fieldId: "custentity_email_sales",
						value: parentLPOEmail
					});
				} else if (billing == "customer") {
					lpoReferralCustomerRecord.setValue({
						fieldId: "companyname",
						value: business_name
					});
					lpoReferralCustomerRecord.setValue({
						fieldId: "custentity_lpo_invoice_payment",
						value: invoicingMethod[0]
					});

					lpoReferralCustomerRecord.setValue({
						fieldId: "custentity_invoice_by_email",
						value: true
					});
					lpoReferralCustomerRecord.setValue({
						fieldId: "custentity18",
						value: true
					});
					lpoReferralCustomerRecord.setValue({
						fieldId: "custentity_invoice_method",
						value: 2
					});
					lpoReferralCustomerRecord.setValue({
						fieldId: "email",
						value: contact_email
					});
					lpoReferralCustomerRecord.setValue({
						fieldId: "custentity_email_service",
						value: contact_email
					});
					lpoReferralCustomerRecord.setValue({
						fieldId: "custentity_email_sales",
						value: contact_email
					});
				}

				lpoReferralCustomerRecord.setValue({
					fieldId: "custentity_lpo_synced_with_db",
					value: 1
				});

				lpoReferralCustomerRecord.setValue({
					fieldId: "partner",
					value: leadZeeAssigned
				});

				lpoReferralCustomerRecord.setValue({
					fieldId: "phone",
					value: phone_number
				});
				lpoReferralCustomerRecord.setValue({
					fieldId: "leadsource",
					value: 282083 //LPO - AP Customer
				});
				if (billing == "customer") {
					lpoReferralCustomerRecord.setValue({
						fieldId: "entitystatus",
						value: 81 //PROSPECT - LPO OPPORTUNITY
					});
				} else if (billing == "lpo") {
					lpoReferralCustomerRecord.setValue({
						fieldId: "entitystatus",
						value: 80 //CUSTOMER - LPO SIGNED
					});
				}
				lpoReferralCustomerRecord.setValue({
					fieldId: "custentity_hotleads",
					value: true
				});

				lpoReferralCustomerRecord.setValue({
					fieldId: "custentity_industry_category",
					value: 19
				});
				lpoReferralCustomerRecord.setValue({
					fieldId: "custentity_date_lead_entered",
					value: getDate()
				});
				lpoReferralCustomerRecord.setValue({
					fieldId: "custentity_lead_entered_by",
					value: 585236
				});
				lpoReferralCustomerRecord.setValue({
					fieldId: "custentity_mpex_invoicing_cycle",
					value: 2
				});
				lpoReferralCustomerRecord.setValue({
					fieldId: "custentity_lpo_account_status",
					value: 2
				});
				lpoReferralCustomerRecord.setValue({
					fieldId: "custentity_date_lpo_validated",
					value: getDate()
				});
				lpoReferralCustomerRecord.setValue({
					fieldId: "custentity_service_fuel_surcharge",
					value: 2
				});
				lpoReferralCustomerRecord.setValue({
					fieldId: "custentity_mpex_surcharge",
					value: 1
				});
				lpoReferralCustomerRecord.setValue({
					fieldId: "custentity_mp_toll_salesrep",
					value: leadSalesRepAssigned
				});

				if (billing == "lpo") {
					lpoReferralCustomerRecord.setValue({
						fieldId: "custentity_terms_conditions_agree_date",
						value: getDate()
					});
					lpoReferralCustomerRecord.setValue({
						fieldId: "custentity_cust_closed_won",
						value: true
					});
					lpoReferralCustomerRecord.setValue({
						fieldId: "custentity_date_prospect_opportunity",
						value: getDate()
					});
					lpoReferralCustomerRecord.setValue({
						fieldId: "custentity_terms_conditions_agree",
						value: 1
					});
				}

				//CREATE ADDRESS FOR PARENT LPO CUSTOMER
				lpoReferralCustomerRecord.selectNewLine({
					sublistId: "addressbook"
				});
				lpoReferralCustomerRecord.setCurrentSublistValue({
					sublistId: "addressbook",
					fieldId: "label",
					value: "Site Address"
				});
				var addressSubrecord =
					lpoReferralCustomerRecord.getCurrentSublistSubrecord({
						sublistId: "addressbook",
						fieldId: "addressbookaddress"
					});

				// Set values on the subrecord.
				// Set country field first when script uses dynamic mode
				addressSubrecord.setValue({
					fieldId: "country",
					value: "AU"
				});

				addressSubrecord.setValue({
					fieldId: "internalid",
					value: 1
				});

				addressSubrecord.setValue({
					fieldId: "city",
					value: city
				});

				addressSubrecord.setValue({
					fieldId: "state",
					value: state
				});

				addressSubrecord.setValue({
					fieldId: "zip",
					value: postcode
				});

				addressSubrecord.setValue({
					fieldId: "addr1",
					value: address1
				});
				addressSubrecord.setValue({
					fieldId: "addr2",
					value: address2
				});
				addressSubrecord.setValue({
					fieldId: "custrecord_address_lat",
					value: lat
				});
				addressSubrecord.setValue({
					fieldId: "custrecord_address_lon",
					value: lng
				});

				addressSubrecord.setValue({
					fieldId: "defaultshipping",
					value: true
				});
				addressSubrecord.setValue({
					fieldId: "defaultbilling",
					value: true
				});
				addressSubrecord.setValue({
					fieldId: "isresidential",
					value: false
				});
				addressSubrecord.setValue({
					fieldId: "addressee",
					value: business_name
				});

				lpoReferralCustomerRecord.commitLine({
					sublistId: "addressbook"
				});

				lpoScheduledServiceCustomerInternalID =
					lpoReferralCustomerRecord.save();

				log.audit({
					title:
						"LPO Scheduled Service Customer Internal ID created for " + zeeId,
					details: lpoScheduledServiceCustomerInternalID
				});

				var lpoScheduledServiceCustomerBookingRecord = record.load({
					type: record.Type.PROSPECT,
					id: lpoScheduledServiceCustomerInternalID
				});

				var lpoScheduledServiceCustomerEntityID =
					lpoScheduledServiceCustomerBookingRecord.getValue({
						fieldId: "entityid"
					});

				//CREATE CONTACT FOR THE REFERALL LEAD
				var contactRecord = record.create({
					type: record.Type.CONTACT
				});

				contactRecord.setValue({
					fieldId: "company",
					value: lpoScheduledServiceCustomerInternalID
				});
				contactRecord.setValue({
					fieldId: "firstname",
					value: first_name
				});
				contactRecord.setValue({
					fieldId: "lastname",
					value: last_name
				});
				contactRecord.setValue({
					fieldId: "entityid",
					value: first_name + " " + last_name
				});
				contactRecord.setValue({
					fieldId: "email",
					value: contact_email
				});
				contactRecord.setValue({
					fieldId: "phone",
					value: phone_number
				});
				contactRecord.setValue({ fieldId: "contactrole", value: -10 });

				var contactId = contactRecord.save({ ignoreMandatoryFields: true });

				if (!isNullorEmpty(lpo_notes)) {
					//CREATE USER NOTE
					var userNoteRecord = record.create({
						type: record.Type.NOTE,
						isDynamic: true
					});

					userNoteRecord.setValue({
						fieldId: "entity",
						value: parseInt(lpoScheduledServiceCustomerInternalID)
					});

					userNoteRecord.setValue({
						fieldId: "title",
						value: "LPO Referral - New Lead"
					});

					userNoteRecord.setValue({
						fieldId: "direction",
						value: 1
					});

					userNoteRecord.setValue({
						fieldId: "notetype",
						value: 7
					});

					userNoteRecord.setValue({
						fieldId: "author",
						value: userId
					});

					userNoteRecord.setValue({
						fieldId: "notedate",
						value: getDate()
					});

					userNoteRecord.setValue({
						fieldId: "note",
						value: lpo_notes
					});

					var userNoteRecordId = userNoteRecord.save();
				}

				//CREATE SALES RECORD
				var recSales = record.create({
					type: "customrecord_sales"
				});
				recSales.setValue({
					fieldId: "custrecord_sales_customer",
					value: lpoScheduledServiceCustomerInternalID
				});
				recSales.setValue({
					fieldId: "custrecord_sales_assigned",
					value: leadSalesRepAssigned
				});
				recSales.setValue({
					fieldId: "custrecord_sales_outcome",
					value: 5
				});
				recSales.setValue({
					fieldId: "custrecord_sales_callbackdate",
					value: getDate()
				});
				recSales.setValue({
					fieldId: "custrecord_sales_callbacktime",
					value: time_now
				});
				recSales.setValue({
					fieldId: "custrecord_sales_campaign",
					value: 69 //LPO campaign
				});
				var newSalesRecordInternalId = recSales.save({
					ignoreMandatoryFields: true
				});

				//CREATE COMM REG
				var customer_comm_reg = record.create({
					type: "customrecord_commencement_register",
					isDynamic: true
				});
				customer_comm_reg.setValue({
					fieldId: "custrecord_date_entry",
					value: getDateStoreNS()
				});
				customer_comm_reg.setValue({
					fieldId: "custrecord_comm_date",
					value: serviceDateEffective
				});
				customer_comm_reg.setValue({
					fieldId: "custrecord_comm_date_signup",
					value: getDateStoreNS()
				});
				customer_comm_reg.setValue({
					fieldId: "custrecord_customer",
					value: lpoScheduledServiceCustomerInternalID
				});
				customer_comm_reg.setValue({
					fieldId: "custrecord_salesrep",
					value: userId
				});
				customer_comm_reg.setValue({
					fieldId: "custrecord_franchisee",
					value: zeeId
				});
				customer_comm_reg.setValue({
					fieldId: "custrecord_wkly_svcs",
					value: "5"
				});
				customer_comm_reg.setValue({
					fieldId: "custrecord_in_out",
					value: 2
				}); // Inbound
				customer_comm_reg.setValue({
					fieldId: "custrecord_state",
					value: getStateId(state)
				});
				customer_comm_reg.setValue({
					fieldId: "custrecord_sale_type",
					value: 1
				});
				customer_comm_reg.setValue({
					fieldId: "custrecord_commreg_sales_record",
					value: newSalesRecordInternalId
				});
				if (billing == "customer") {
					customer_comm_reg.setValue({
						fieldId: "custrecord_trial_status",
						value: 10 //Quote
					});
				} else if (billing == "lpo") {
					customer_comm_reg.setValue({
						fieldId: "custrecord_trial_status",
						value: 2 //Signed
					});
					customer_comm_reg.setValue({
						fieldId: "custrecord_tnc_agreement_date",
						value: getDateToday()
					});
				}
				newCommRegInternalId = customer_comm_reg.save();
				log.audit({
					title: "Comm Reg Record created",
					details: newCommRegInternalId
				});

				//Search Name: LPO Sub Customer - Active Services List
				var lpoSubCustomerListSearch = search.load({
					type: "customer",
					id: "customsearch_lpo_sub_customer_list"
				});

				lpoSubCustomerListSearch.filters.push(
					search.createFilter({
						name: "internalid",
						join: "parentcustomer",
						operator: search.Operator.ANYOF,
						values: parent_lpo
					})
				);

				var countServiceList = 0;
				var serviceList = [];
				var oldLPOSubCustomerInternalId = 0;
				var lpoSubCustomerServiceToBeCreatedInternalID = 0;

				var oldShipaddress1 = "";
				var oldShipaddress2 = "";
				var oldShipcity = "";
				var oldShipstate = "";
				var oldShipzip = "";

				var oldContactName = "";
				var oldContactEmail = "";
				var oldContactPhone = "";

				lpoSubCustomerListSearch.run().each(function (resultSet) {
					var lpoSubCustomerInternalID = resultSet.getValue({
						name: "internalid"
					});

					var shipaddress1 = resultSet.getValue({
						name: "shipaddress1"
					});
					var shipaddress2 = resultSet.getValue({
						name: "shipaddress2"
					});
					var shipcity = resultSet.getValue({
						name: "shipcity"
					});
					var shipstate = resultSet.getValue({
						name: "shipstate"
					});
					var shipzip = resultSet.getValue({
						name: "shipzip"
					});

					var contactName = resultSet.getValue({
						name: "entityid",
						join: "contactPrimary"
					});
					var contactEmail = resultSet.getValue({
						name: "email",
						join: "contactPrimary"
					});
					var contactPhone = resultSet.getValue({
						name: "phone",
						join: "contactPrimary"
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
						rate: parseFloat(
							resultSet.getValue({
								name: "custrecord_service_price",
								join: "CUSTRECORD_SERVICE_CUSTOMER"
							})
						)
					};
					serviceList.push(service);
					if (
						oldLPOSubCustomerInternalId != 0 &&
						oldLPOSubCustomerInternalId != lpoSubCustomerInternalID
					) {
						lpoSubCustomerServiceToBeCreatedInternalID =
							oldLPOSubCustomerInternalId;
						lpoAddress1 = oldShipaddress1;
						lpoAddress2 = oldShipaddress2;
						lpoCity = oldShipcity;
						lpoState = oldShipstate;
						lpoZip = oldShipzip;
						lpoContactName = oldContactName;
						lpoContactEmail = oldContactEmail;
						lpoContactPhone = oldContactPhone;
						return false; //Stop the loop if we have already processed the sub customer
					}

					oldLPOSubCustomerInternalId = lpoSubCustomerInternalID;
					oldShipaddress1 = shipaddress1;
					oldShipaddress2 = shipaddress2;
					oldShipcity = shipcity;
					oldShipstate = shipstate;
					oldShipzip = shipzip;
					oldContactName = contactName;
					oldContactEmail = contactEmail;
					oldContactPhone = contactPhone;
					countServiceList++;
					return true;
				});

				if (countServiceList > 0) {
					lpoSubCustomerServiceToBeCreatedInternalID =
						oldLPOSubCustomerInternalId;
					lpoAddress1 = oldShipaddress1;
					lpoAddress2 = oldShipaddress2;
					lpoCity = oldShipcity;
					lpoState = oldShipstate;
					lpoZip = oldShipzip;
					lpoContactName = oldContactName;
					lpoContactEmail = oldContactEmail;
					lpoContactPhone = oldContactPhone;
				}

				log.audit({
					title: "serviceList",
					details: JSON.stringify(serviceList)
				});

				var serviceAMPO = { id: 0, rate: 0 };
				serviceAMPO = getServiceRate(serviceList, "AMPO");

				//CREATE SERVICE RECORD
				log.audit({
					title: "Before creating service records",
					details: ""
				});

				// log.audit({
				//     title: 'leadSelectedService',
				//     details: leadSelectedService
				// })
				log.audit({
					title: "lead_selected_service_text",
					details: lead_selected_service_text
				});

				if (billing == "customer") {
					if (lead_selected_service_text == "lpo-to-site") {
						scheduleServiceFor = "AMPO";

						//AMPO SERVICE
						var serviceRecord = record.create({
							type: "customrecord_service",
							isDynamic: true
						});
						serviceRecord.setValue({ fieldId: "name", value: "AMPO" });
						serviceRecord.setValue({
							fieldId: "custrecord_service_price",
							value: serviceAMPO.rate
						});
						serviceRecord.setValue({
							fieldId: "custrecord_service",
							value: 1
						});
						serviceRecord.setValue({
							fieldId: "custrecord_service_comm_reg",
							value: newCommRegInternalId
						});
						serviceRecord.setValue({
							fieldId: "custrecord_service_customer",
							value: lpoScheduledServiceCustomerInternalID
						});
						serviceRecord.setValue({
							fieldId: "custrecord_service_franchisee",
							value: zeeId
						});

						var freqArray = [];
						var new_service_freq = [0, 0, 0, 0, 0];
						if (!isNullorEmpty(lead_service_freq)) {
							var lead_service_freq_array = lead_service_freq.split(",");

							for (var i = 0; i < lead_service_freq_array.length; i++) {
								if (lead_service_freq_array[i] == "Mon") {
									new_service_freq[0] = "1";
									freqArray[0] = 1;
								}
								if (lead_service_freq_array[i] == "Tue") {
									new_service_freq[1] = "1";
									freqArray[1] = 1;
								}
								if (lead_service_freq_array[i] == "Wed") {
									new_service_freq[2] = "1";
									freqArray[2] = 1;
								}
								if (lead_service_freq_array[i] == "Thu") {
									new_service_freq[3] = "1";
									freqArray[3] = 1;
								}
								if (lead_service_freq_array[i] == "Fri") {
									new_service_freq[4] = "1";
									freqArray[4] = 1;
								}
							}

							if (new_service_freq[0] == "1") {
								serviceRecord.setValue({
									fieldId: "custrecord_service_day_mon",
									value: true
								});
							}
							if (new_service_freq[1] == "1") {
								serviceRecord.setValue({
									fieldId: "custrecord_service_day_tue",
									value: true
								});
							}
							if (new_service_freq[2] == "1") {
								serviceRecord.setValue({
									fieldId: "custrecord_service_day_wed",
									value: true
								});
							}
							if (new_service_freq[3] == "1") {
								serviceRecord.setValue({
									fieldId: "custrecord_service_day_thu",
									value: true
								});
							}
							if (new_service_freq[4] == "1") {
								serviceRecord.setValue({
									fieldId: "custrecord_service_day_fri",
									value: true
								});
							}
							if (new_service_freq[5] == "1") {
								serviceRecord.setValue({
									fieldId: "custrecord_service_day_sat",
									value: true
								});
							}
						} else {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_adhoc",
								value: true
							});
						}

						var ampoServiceInternalId = serviceRecord.save();
						if (lead_selected_service_text == "lpo-to-site") {
							scheduledServiceInternalId = ampoServiceInternalId;
						}
						log.audit({
							title: "AMPO Service Created",
							details: ampoServiceInternalId
						});

						localmileAMPOInternalID = ampoServiceInternalId;
						localmileAMPORate = serviceAMPO.rate;

						//CREATE SERVICE CHANGE RECORD FOR AMPO SERVICE
						var new_service_change_record = record.create({
							type: "customrecord_servicechg",
							isDynamic: true
						});
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_date_effective",
							value: serviceDateEffective
						});
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_service",
							value: ampoServiceInternalId
						});

						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_old_zee",
							value: zeeId
						});

						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_new_price",
							value: serviceAMPO.rate
						});

						if (isNullorEmpty(freqArray)) {
							new_service_change_record.setValue({
								fieldId: "custrecord_servicechg_new_freq",
								value: 6
							});
							new_service_change_record.setValue({
								fieldId: "custrecord_servicechg_status",
								value: 2 //Active
							});
						} else {
							new_service_change_record.setValue({
								fieldId: "custrecord_servicechg_new_freq",
								value: freqArray
							});
							if (billing == "customer") {
								new_service_change_record.setValue({
									fieldId: "custrecord_servicechg_status",
									value: 4 //Quote
								});
							} else {
								new_service_change_record.setValue({
									fieldId: "custrecord_servicechg_status",
									value: 2 //Active
								});
							}
						}
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_comm_reg",
							value: newCommRegInternalId
						});
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_created",
							value: userId
						});
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_type",
							value: "New Customer"
						});
						new_service_change_record.setValue({
							fieldId: "custrecord_default_servicechg_record",
							value: 1
						});

						var ampoServiceChangeRecordInternalId =
							new_service_change_record.save();
						log.audit({
							title: "AMPO Service Change Record Created",
							details: ampoServiceChangeRecordInternalId
						});
					}

					var servicePMPO = { id: 0, rate: 0 };
					servicePMPO = getServiceRate(serviceList, "PMPO");

					//PMPO SERVICE
					if (lead_selected_service_text == "site-to-lpo") {
						scheduleServiceFor = "PMPO";

						var serviceRecord = record.create({
							type: "customrecord_service",
							isDynamic: true
						});
						serviceRecord.setValue({ fieldId: "name", value: "PMPO" });
						serviceRecord.setValue({
							fieldId: "custrecord_service_price",
							value: servicePMPO.rate
						});
						serviceRecord.setValue({
							fieldId: "custrecord_service",
							value: 4
						});
						serviceRecord.setValue({
							fieldId: "custrecord_service_comm_reg",
							value: newCommRegInternalId
						});
						serviceRecord.setValue({
							fieldId: "custrecord_service_customer",
							value: lpoScheduledServiceCustomerInternalID
						});
						serviceRecord.setValue({
							fieldId: "custrecord_service_franchisee",
							value: zeeId
						});
						var freqArray = [];
						var new_service_freq = [0, 0, 0, 0, 0];
						if (!isNullorEmpty(lead_service_freq)) {
							var lead_service_freq_array = lead_service_freq.split(",");

							for (var i = 0; i < lead_service_freq_array.length; i++) {
								if (lead_service_freq_array[i] == "Mon") {
									new_service_freq[0] = "1";
									freqArray[0] = 1;
								}
								if (lead_service_freq_array[i] == "Tue") {
									new_service_freq[1] = "1";
									freqArray[1] = 1;
								}
								if (lead_service_freq_array[i] == "Wed") {
									new_service_freq[2] = "1";
									freqArray[2] = 1;
								}
								if (lead_service_freq_array[i] == "Thu") {
									new_service_freq[3] = "1";
									freqArray[3] = 1;
								}
								if (lead_service_freq_array[i] == "Fri") {
									new_service_freq[4] = "1";
									freqArray[4] = 1;
								}
							}

							if (new_service_freq[0] == "1") {
								serviceRecord.setValue({
									fieldId: "custrecord_service_day_mon",
									value: true
								});
							}
							if (new_service_freq[1] == "1") {
								serviceRecord.setValue({
									fieldId: "custrecord_service_day_tue",
									value: true
								});
							}
							if (new_service_freq[2] == "1") {
								serviceRecord.setValue({
									fieldId: "custrecord_service_day_wed",
									value: true
								});
							}
							if (new_service_freq[3] == "1") {
								serviceRecord.setValue({
									fieldId: "custrecord_service_day_thu",
									value: true
								});
							}
							if (new_service_freq[4] == "1") {
								serviceRecord.setValue({
									fieldId: "custrecord_service_day_fri",
									value: true
								});
							}
							if (new_service_freq[5] == "1") {
								serviceRecord.setValue({
									fieldId: "custrecord_service_day_sat",
									value: true
								});
							}
						} else {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_adhoc",
								value: true
							});
						}
						var pmpoServiceInternalId = serviceRecord.save();
						if (lead_selected_service_text == "site-to-lpo") {
							scheduledServiceInternalId = pmpoServiceInternalId;
						}
						log.audit({
							title: "PMPO Service Record Created",
							details: pmpoServiceInternalId
						});

						localmilePMPOInternalID = pmpoServiceInternalId;
						localmilePMPORate = servicePMPO.rate;

						//CREATE SERVICE CHANGE RECORD FOR PMPO SERVICE
						var new_service_change_record = record.create({
							type: "customrecord_servicechg",
							isDynamic: true
						});
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_date_effective",
							value: serviceDateEffective
						});
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_service",
							value: pmpoServiceInternalId
						});
						// new_service_change_record.setValue({
						//     fieldId: "custrecord_servicechg_status",
						//     value: 4,
						// });
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_old_zee",
							value: zeeId
						});

						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_new_price",
							value: servicePMPO.rate
						});
						if (isNullorEmpty(freqArray)) {
							new_service_change_record.setValue({
								fieldId: "custrecord_servicechg_new_freq",
								value: 6
							});
							new_service_change_record.setValue({
								fieldId: "custrecord_servicechg_status",
								value: 2 //Active
							});
						} else {
							new_service_change_record.setValue({
								fieldId: "custrecord_servicechg_new_freq",
								value: freqArray
							});
							if (billing == "customer") {
								new_service_change_record.setValue({
									fieldId: "custrecord_servicechg_status",
									value: 4 //Quote
								});
							} else {
								new_service_change_record.setValue({
									fieldId: "custrecord_servicechg_status",
									value: 2 //Active
								});
							}
						}
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_comm_reg",
							value: newCommRegInternalId
						});
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_created",
							value: userId
						});
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_type",
							value: "New Customer"
						});
						new_service_change_record.setValue({
							fieldId: "custrecord_default_servicechg_record",
							value: 1
						});

						var pmpoServiceChangeRecordInternalId =
							new_service_change_record.save();

						log.audit({
							title: "PMPO Service Change Record Created",
							details: pmpoServiceChangeRecordInternalId
						});
					}
					var serviceAMPOPMPO = { id: 0, rate: 0 };
					serviceAMPOPMPO = getServiceRate(serviceList, "Package: AMPO & PMPO");

					//PACKAGE: AMPO & PMPO SERVICE
					if (lead_selected_service_text == "round-trip") {
						scheduleServiceFor = "Package: AMPO & PMPO";

						var serviceRecord = record.create({
							type: "customrecord_service",
							isDynamic: true
						});
						serviceRecord.setValue({
							fieldId: "name",
							value: "Package: AMPO & PMPO"
						});
						serviceRecord.setValue({
							fieldId: "custrecord_service_price",
							value: serviceAMPOPMPO.rate
						});
						serviceRecord.setValue({
							fieldId: "custrecord_service",
							value: 47
						});
						serviceRecord.setValue({
							fieldId: "custrecord_service_comm_reg",
							value: newCommRegInternalId
						});
						serviceRecord.setValue({
							fieldId: "custrecord_service_customer",
							value: lpoScheduledServiceCustomerInternalID
						});
						serviceRecord.setValue({
							fieldId: "custrecord_service_franchisee",
							value: zeeId
						});

						var freqArray = [];
						var new_service_freq = [0, 0, 0, 0, 0];
						if (!isNullorEmpty(lead_service_freq)) {
							var lead_service_freq_array = lead_service_freq.split(",");

							for (var i = 0; i < lead_service_freq_array.length; i++) {
								if (lead_service_freq_array[i] == "Mon") {
									new_service_freq[0] = "1";
									freqArray[0] = 1;
								}
								if (lead_service_freq_array[i] == "Tue") {
									new_service_freq[1] = "1";
									freqArray[1] = 1;
								}
								if (lead_service_freq_array[i] == "Wed") {
									new_service_freq[2] = "1";
									freqArray[2] = 1;
								}
								if (lead_service_freq_array[i] == "Thu") {
									new_service_freq[3] = "1";
									freqArray[3] = 1;
								}
								if (lead_service_freq_array[i] == "Fri") {
									new_service_freq[4] = "1";
									freqArray[4] = 1;
								}
							}

							if (new_service_freq[0] == "1") {
								serviceRecord.setValue({
									fieldId: "custrecord_service_day_mon",
									value: true
								});
							}
							if (new_service_freq[1] == "1") {
								serviceRecord.setValue({
									fieldId: "custrecord_service_day_tue",
									value: true
								});
							}
							if (new_service_freq[2] == "1") {
								serviceRecord.setValue({
									fieldId: "custrecord_service_day_wed",
									value: true
								});
							}
							if (new_service_freq[3] == "1") {
								serviceRecord.setValue({
									fieldId: "custrecord_service_day_thu",
									value: true
								});
							}
							if (new_service_freq[4] == "1") {
								serviceRecord.setValue({
									fieldId: "custrecord_service_day_fri",
									value: true
								});
							}
							if (new_service_freq[5] == "1") {
								serviceRecord.setValue({
									fieldId: "custrecord_service_day_sat",
									value: true
								});
							}
						} else {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_adhoc",
								value: true
							});
						}
						var ampoPmpoServiceInternalId = serviceRecord.save();
						if (lead_selected_service_text == "round-trip") {
							scheduledServiceInternalId = ampoPmpoServiceInternalId;
						}
						log.audit({
							title: "Package: AMPO & PMPO Service Record Created",
							details: ampoPmpoServiceInternalId
						});

						//CREATE SERVICE CHANGE RECORD FOR PACKAGE: AMPO & PMPO SERVICE
						var new_service_change_record = record.create({
							type: "customrecord_servicechg",
							isDynamic: true
						});
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_date_effective",
							value: serviceDateEffective
						});
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_service",
							value: ampoPmpoServiceInternalId
						});
						// new_service_change_record.setValue({
						//     fieldId: "custrecord_servicechg_status",
						//     value: 4,
						// });
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_old_zee",
							value: zeeId
						});

						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_new_price",
							value: serviceAMPOPMPO.rate
						});
						if (isNullorEmpty(freqArray)) {
							new_service_change_record.setValue({
								fieldId: "custrecord_servicechg_new_freq",
								value: 6
							});
							new_service_change_record.setValue({
								fieldId: "custrecord_servicechg_status",
								value: 2 //Active
							});
						} else {
							new_service_change_record.setValue({
								fieldId: "custrecord_servicechg_new_freq",
								value: freqArray
							});
							if (billing == "customer") {
								new_service_change_record.setValue({
									fieldId: "custrecord_servicechg_status",
									value: 4 //Quote
								});
							} else {
								new_service_change_record.setValue({
									fieldId: "custrecord_servicechg_status",
									value: 2 //Active
								});
							}
						}
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_comm_reg",
							value: newCommRegInternalId
						});
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_created",
							value: userId
						});
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_type",
							value: "New Customer"
						});
						new_service_change_record.setValue({
							fieldId: "custrecord_default_servicechg_record",
							value: 1
						});

						var ampoPmpoServiceChangeRecordInternalId =
							new_service_change_record.save();
						log.audit({
							title: "Package: AMPO & PMPO Service Change Record Created",
							details: ampoPmpoServiceChangeRecordInternalId
						});
					}
				} else if (billing == "lpo") {
					var serviceAMPO = { id: 0, rate: 0 };
					serviceAMPO = getServiceRate(serviceList, "AMPO");
					scheduleServiceFor = "AMPO";

					//AMPO SERVICE
					var serviceRecord = record.create({
						type: "customrecord_service",
						isDynamic: true
					});
					serviceRecord.setValue({ fieldId: "name", value: "AMPO" });
					serviceRecord.setValue({
						fieldId: "custrecord_service_price",
						value: serviceAMPO.rate
					});
					serviceRecord.setValue({
						fieldId: "custrecord_service",
						value: 1
					});
					serviceRecord.setValue({
						fieldId: "custrecord_service_comm_reg",
						value: newCommRegInternalId
					});
					serviceRecord.setValue({
						fieldId: "custrecord_service_customer",
						value: lpoScheduledServiceCustomerInternalID
					});
					serviceRecord.setValue({
						fieldId: "custrecord_service_franchisee",
						value: zeeId
					});

					var freqArray = [];
					var new_service_freq = [0, 0, 0, 0, 0];
					if (!isNullorEmpty(lead_service_freq)) {
						var lead_service_freq_array = lead_service_freq.split(",");

						for (var i = 0; i < lead_service_freq_array.length; i++) {
							if (lead_service_freq_array[i] == "Mon") {
								new_service_freq[0] = "1";
								freqArray[0] = 1;
							}
							if (lead_service_freq_array[i] == "Tue") {
								new_service_freq[1] = "1";
								freqArray[1] = 1;
							}
							if (lead_service_freq_array[i] == "Wed") {
								new_service_freq[2] = "1";
								freqArray[2] = 1;
							}
							if (lead_service_freq_array[i] == "Thu") {
								new_service_freq[3] = "1";
								freqArray[3] = 1;
							}
							if (lead_service_freq_array[i] == "Fri") {
								new_service_freq[4] = "1";
								freqArray[4] = 1;
							}
						}

						if (new_service_freq[0] == "1") {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_mon",
								value: true
							});
						}
						if (new_service_freq[1] == "1") {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_tue",
								value: true
							});
						}
						if (new_service_freq[2] == "1") {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_wed",
								value: true
							});
						}
						if (new_service_freq[3] == "1") {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_thu",
								value: true
							});
						}
						if (new_service_freq[4] == "1") {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_fri",
								value: true
							});
						}
						if (new_service_freq[5] == "1") {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_sat",
								value: true
							});
						}
					} else {
						serviceRecord.setValue({
							fieldId: "custrecord_service_day_adhoc",
							value: true
						});
					}

					var ampoServiceInternalId = serviceRecord.save();
					if (lead_selected_service_text == "lpo-to-site") {
						scheduledServiceInternalId = ampoServiceInternalId;
					}
					log.audit({
						title: "AMPO Service Created",
						details: ampoServiceInternalId
					});

					localmileAMPOInternalID = ampoServiceInternalId;
					localmileAMPORate = serviceAMPO.rate;

					//CREATE SERVICE CHANGE RECORD FOR AMPO SERVICE
					var new_service_change_record = record.create({
						type: "customrecord_servicechg",
						isDynamic: true
					});
					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_date_effective",
						value: serviceDateEffective
					});
					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_service",
						value: ampoServiceInternalId
					});

					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_old_zee",
						value: zeeId
					});

					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_new_price",
						value: serviceAMPO.rate
					});

					if (isNullorEmpty(freqArray)) {
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_new_freq",
							value: 6
						});
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_status",
							value: 2 //Active
						});
					} else {
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_new_freq",
							value: freqArray
						});
						if (billing == "customer") {
							new_service_change_record.setValue({
								fieldId: "custrecord_servicechg_status",
								value: 4 //Quote
							});
						} else {
							new_service_change_record.setValue({
								fieldId: "custrecord_servicechg_status",
								value: 2 //Active
							});
						}
					}
					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_comm_reg",
						value: newCommRegInternalId
					});
					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_created",
						value: userId
					});
					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_type",
						value: "New Customer"
					});
					new_service_change_record.setValue({
						fieldId: "custrecord_default_servicechg_record",
						value: 1
					});

					var ampoServiceChangeRecordInternalId =
						new_service_change_record.save();
					log.audit({
						title: "AMPO Service Change Record Created",
						details: ampoServiceChangeRecordInternalId
					});

					var servicePMPO = { id: 0, rate: 0 };
					servicePMPO = getServiceRate(serviceList, "PMPO");

					scheduleServiceFor = "PMPO";

					var serviceRecord = record.create({
						type: "customrecord_service",
						isDynamic: true
					});
					serviceRecord.setValue({ fieldId: "name", value: "PMPO" });
					serviceRecord.setValue({
						fieldId: "custrecord_service_price",
						value: servicePMPO.rate
					});
					serviceRecord.setValue({
						fieldId: "custrecord_service",
						value: 4
					});
					serviceRecord.setValue({
						fieldId: "custrecord_service_comm_reg",
						value: newCommRegInternalId
					});
					serviceRecord.setValue({
						fieldId: "custrecord_service_customer",
						value: lpoScheduledServiceCustomerInternalID
					});
					serviceRecord.setValue({
						fieldId: "custrecord_service_franchisee",
						value: zeeId
					});
					var freqArray = [];
					var new_service_freq = [0, 0, 0, 0, 0];
					if (!isNullorEmpty(lead_service_freq)) {
						var lead_service_freq_array = lead_service_freq.split(",");

						for (var i = 0; i < lead_service_freq_array.length; i++) {
							if (lead_service_freq_array[i] == "Mon") {
								new_service_freq[0] = "1";
								freqArray[0] = 1;
							}
							if (lead_service_freq_array[i] == "Tue") {
								new_service_freq[1] = "1";
								freqArray[1] = 1;
							}
							if (lead_service_freq_array[i] == "Wed") {
								new_service_freq[2] = "1";
								freqArray[2] = 1;
							}
							if (lead_service_freq_array[i] == "Thu") {
								new_service_freq[3] = "1";
								freqArray[3] = 1;
							}
							if (lead_service_freq_array[i] == "Fri") {
								new_service_freq[4] = "1";
								freqArray[4] = 1;
							}
						}

						if (new_service_freq[0] == "1") {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_mon",
								value: true
							});
						}
						if (new_service_freq[1] == "1") {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_tue",
								value: true
							});
						}
						if (new_service_freq[2] == "1") {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_wed",
								value: true
							});
						}
						if (new_service_freq[3] == "1") {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_thu",
								value: true
							});
						}
						if (new_service_freq[4] == "1") {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_fri",
								value: true
							});
						}
						if (new_service_freq[5] == "1") {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_sat",
								value: true
							});
						}
					} else {
						serviceRecord.setValue({
							fieldId: "custrecord_service_day_adhoc",
							value: true
						});
					}
					var pmpoServiceInternalId = serviceRecord.save();
					if (lead_selected_service_text == "site-to-lpo") {
						scheduledServiceInternalId = pmpoServiceInternalId;
					}
					log.audit({
						title: "PMPO Service Record Created",
						details: pmpoServiceInternalId
					});

					localmilePMPOInternalID = pmpoServiceInternalId;
					localmilePMPORate = servicePMPO.rate;

					//CREATE SERVICE CHANGE RECORD FOR PMPO SERVICE
					var new_service_change_record = record.create({
						type: "customrecord_servicechg",
						isDynamic: true
					});
					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_date_effective",
						value: serviceDateEffective
					});
					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_service",
						value: pmpoServiceInternalId
					});
					// new_service_change_record.setValue({
					//     fieldId: "custrecord_servicechg_status",
					//     value: 4,
					// });
					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_old_zee",
						value: zeeId
					});

					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_new_price",
						value: servicePMPO.rate
					});
					if (isNullorEmpty(freqArray)) {
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_new_freq",
							value: 6
						});
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_status",
							value: 2 //Active
						});
					} else {
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_new_freq",
							value: freqArray
						});
						if (billing == "customer") {
							new_service_change_record.setValue({
								fieldId: "custrecord_servicechg_status",
								value: 4 //Quote
							});
						} else {
							new_service_change_record.setValue({
								fieldId: "custrecord_servicechg_status",
								value: 2 //Active
							});
						}
					}
					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_comm_reg",
						value: newCommRegInternalId
					});
					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_created",
						value: userId
					});
					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_type",
						value: "New Customer"
					});
					new_service_change_record.setValue({
						fieldId: "custrecord_default_servicechg_record",
						value: 1
					});

					var pmpoServiceChangeRecordInternalId =
						new_service_change_record.save();

					log.audit({
						title: "PMPO Service Change Record Created",
						details: pmpoServiceChangeRecordInternalId
					});
					var serviceAMPOPMPO = { id: 0, rate: 0 };
					serviceAMPOPMPO = getServiceRate(serviceList, "Package: AMPO & PMPO");
					scheduleServiceFor = "Package: AMPO & PMPO";

					var serviceRecord = record.create({
						type: "customrecord_service",
						isDynamic: true
					});
					serviceRecord.setValue({
						fieldId: "name",
						value: "Package: AMPO & PMPO"
					});
					serviceRecord.setValue({
						fieldId: "custrecord_service_price",
						value: serviceAMPOPMPO.rate
					});
					serviceRecord.setValue({
						fieldId: "custrecord_service",
						value: 47
					});
					serviceRecord.setValue({
						fieldId: "custrecord_service_comm_reg",
						value: newCommRegInternalId
					});
					serviceRecord.setValue({
						fieldId: "custrecord_service_customer",
						value: lpoScheduledServiceCustomerInternalID
					});
					serviceRecord.setValue({
						fieldId: "custrecord_service_franchisee",
						value: zeeId
					});

					var freqArray = [];
					var new_service_freq = [0, 0, 0, 0, 0];
					if (!isNullorEmpty(lead_service_freq)) {
						var lead_service_freq_array = lead_service_freq.split(",");

						for (var i = 0; i < lead_service_freq_array.length; i++) {
							if (lead_service_freq_array[i] == "Mon") {
								new_service_freq[0] = "1";
								freqArray[0] = 1;
							}
							if (lead_service_freq_array[i] == "Tue") {
								new_service_freq[1] = "1";
								freqArray[1] = 1;
							}
							if (lead_service_freq_array[i] == "Wed") {
								new_service_freq[2] = "1";
								freqArray[2] = 1;
							}
							if (lead_service_freq_array[i] == "Thu") {
								new_service_freq[3] = "1";
								freqArray[3] = 1;
							}
							if (lead_service_freq_array[i] == "Fri") {
								new_service_freq[4] = "1";
								freqArray[4] = 1;
							}
						}

						if (new_service_freq[0] == "1") {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_mon",
								value: true
							});
						}
						if (new_service_freq[1] == "1") {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_tue",
								value: true
							});
						}
						if (new_service_freq[2] == "1") {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_wed",
								value: true
							});
						}
						if (new_service_freq[3] == "1") {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_thu",
								value: true
							});
						}
						if (new_service_freq[4] == "1") {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_fri",
								value: true
							});
						}
						if (new_service_freq[5] == "1") {
							serviceRecord.setValue({
								fieldId: "custrecord_service_day_sat",
								value: true
							});
						}
					} else {
						serviceRecord.setValue({
							fieldId: "custrecord_service_day_adhoc",
							value: true
						});
					}
					var ampoPmpoServiceInternalId = serviceRecord.save();
					if (lead_selected_service_text == "round-trip") {
						scheduledServiceInternalId = ampoPmpoServiceInternalId;
					}
					log.audit({
						title: "Package: AMPO & PMPO Service Record Created",
						details: ampoPmpoServiceInternalId
					});

					localmileAMPOPMPOInternalID = ampoPmpoServiceInternalId;
					localmileAMPOPMPORate = serviceAMPOPMPO.rate;

					//CREATE SERVICE CHANGE RECORD FOR PACKAGE: AMPO & PMPO SERVICE
					var new_service_change_record = record.create({
						type: "customrecord_servicechg",
						isDynamic: true
					});
					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_date_effective",
						value: serviceDateEffective
					});
					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_service",
						value: ampoPmpoServiceInternalId
					});
					// new_service_change_record.setValue({
					//     fieldId: "custrecord_servicechg_status",
					//     value: 4,
					// });
					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_old_zee",
						value: zeeId
					});

					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_new_price",
						value: serviceAMPOPMPO.rate
					});
					if (isNullorEmpty(freqArray)) {
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_new_freq",
							value: 6
						});
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_status",
							value: 2 //Active
						});
					} else {
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_new_freq",
							value: freqArray
						});
						if (billing == "customer") {
							new_service_change_record.setValue({
								fieldId: "custrecord_servicechg_status",
								value: 4 //Quote
							});
						} else {
							new_service_change_record.setValue({
								fieldId: "custrecord_servicechg_status",
								value: 2 //Active
							});
						}
					}
					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_comm_reg",
						value: newCommRegInternalId
					});
					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_created",
						value: userId
					});
					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_type",
						value: "New Customer"
					});
					new_service_change_record.setValue({
						fieldId: "custrecord_default_servicechg_record",
						value: 1
					});

					var ampoPmpoServiceChangeRecordInternalId =
						new_service_change_record.save();
					log.audit({
						title: "Package: AMPO & PMPO Service Change Record Created",
						details: ampoPmpoServiceChangeRecordInternalId
					});
				}

				var serviceAdditonalLPOBag = { id: 0, rate: 0 };
				serviceAdditonalLPOBag = getServiceRate(
					serviceList,
					"Additional LPO Bag"
				);

				//Additional LPO Bag
				var serviceRecord = record.create({
					type: "customrecord_service",
					isDynamic: true
				});
				serviceRecord.setValue({
					fieldId: "name",
					value: "Additional LPO Bag"
				});
				serviceRecord.setValue({
					fieldId: "custrecord_service_price",
					value: serviceAdditonalLPOBag.rate
				});
				serviceRecord.setValue({
					fieldId: "custrecord_service",
					value: 155
				});
				serviceRecord.setValue({
					fieldId: "custrecord_service_comm_reg",
					value: newCommRegInternalId
				});
				serviceRecord.setValue({
					fieldId: "custrecord_service_customer",
					value: lpoScheduledServiceCustomerInternalID
				});
				serviceRecord.setValue({
					fieldId: "custrecord_service_franchisee",
					value: zeeId
				});
				serviceRecord.setValue({
					fieldId: "custrecord_service_day_adhoc",
					value: true
				});
				serviceRecord.setValue({
					fieldId: "custrecord_service_day_freq_cycle",
					value: 4
				});
				var excessParcelServiceInternalId = serviceRecord.save();

				log.audit({
					title: "Excess Parcel Service Record Created",
					details: excessParcelServiceInternalId
				});

				localmileAdditionalBagInternalID = excessParcelServiceInternalId;
				localmileAdditionalBagRate = serviceAdditonalLPOBag.rate;

				log.audit({
					title: "Localmile Additional Bag",
					details: localmileAdditionalBagInternalID
				});
				log.audit({
					title: "Localmile Additional Bag Rate",
					details: localmileAdditionalBagRate
				});

				//CREATE SERVICE CHANGE RECORD FOR Additional LPO Bag
				var new_service_change_record = record.create({
					type: "customrecord_servicechg",
					isDynamic: true
				});
				new_service_change_record.setValue({
					fieldId: "custrecord_servicechg_date_effective",
					value: serviceDateEffective
				});
				new_service_change_record.setValue({
					fieldId: "custrecord_servicechg_service",
					value: excessParcelServiceInternalId
				});

				new_service_change_record.setValue({
					fieldId: "custrecord_servicechg_new_freq",
					value: 6
				});
				if (billing == "customer") {
					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_status",
						value: 4 //Quote
					});
				} else {
					new_service_change_record.setValue({
						fieldId: "custrecord_servicechg_status",
						value: 2 //Active
					});
				}

				new_service_change_record.setValue({
					fieldId: "custrecord_servicechg_old_zee",
					value: zeeId
				});

				new_service_change_record.setValue({
					fieldId: "custrecord_servicechg_new_price",
					value: serviceAdditonalLPOBag.rate
				});
				new_service_change_record.setValue({
					fieldId: "custrecord_servicechg_comm_reg",
					value: newCommRegInternalId
				});
				new_service_change_record.setValue({
					fieldId: "custrecord_servicechg_created",
					value: userId
				});
				new_service_change_record.setValue({
					fieldId: "custrecord_servicechg_type",
					value: "New Customer"
				});
				new_service_change_record.setValue({
					fieldId: "custrecord_default_servicechg_record",
					value: 1
				});

				var excessParcelServiceChangeRecordInternalId =
					new_service_change_record.save();

				log.audit({
					title: "Additional LPO Bag",
					details: excessParcelServiceChangeRecordInternalId
				});

				if (
					!isNullorEmpty(lpoScheduledServiceCustomerInternalID) &&
					!isNullorEmpty(lead_selected_service_text) &&
					lpoNewcustomerServiceType == "scheduled"
				) {
					var lpoScheduleServiceCustomerInternalID =
						lpoScheduledServiceCustomerInternalID;
					var leadSelectedService =
						context.request.parameters.lead_selected_service;
					var leadSelectedServiceText =
						context.request.parameters.lead_selected_service_text;
					var leadServiceDate = context.request.parameters.lead_service_date;
					var leadServiceFreq = context.request.parameters.frequency;

					var params = {
						parent_lpo: parent_lpo,
						lpo_subcustomer_id: lpoScheduleServiceCustomerInternalID,
						lead_selected_service: scheduledServiceInternalId,
						lead_selected_service_text: leadSelectedServiceText,
						lead_service_date: leadServiceDate,
						lead_service_freq: leadServiceFreq,
						linked_zees: finalZeeIDArray.toString(),
						payment_type: billing
					};

					//Call Suitelet: Module - LPO - Schedule Service for Cust (Internal ID: 2175)
					var url =
						"https://1048144.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=2175&deploy=1&compid=1048144&ns-at=AAEJ7tMQJLUD4tRlmxwDLvkRTmyAj1mKDb75RpkmQHAPr9GQAXo&parent_lpo=" +
						parseInt(parent_lpo) +
						"&lpo_subcustomer_id=" +
						lpoScheduleServiceCustomerInternalID +
						"&lead_selected_service=" +
						scheduledServiceInternalId +
						"&lead_selected_service_text=" +
						leadSelectedServiceText +
						"&lead_service_date=" +
						leadServiceDate +
						"&lead_service_freq=" +
						leadServiceFreq +
						"&linked_zees=" +
						finalZeeIDArray.toString() +
						"&payment_type=" +
						billing;

					log.debug({
						title: "url",
						details: url
					});

					// var response = https.get({
					// 	url: url
					// });

					// log.debug({
					// 	title: "response",
					// 	details: response
					// });

					//Email Onboarding Team
					var freqArray = "";
					var lead_service_freq_array = leadServiceFreq.split(",");
					var new_service_freq = [0, 0, 0, 0, 0];
					for (var i = 0; i < lead_service_freq_array.length; i++) {
						if (lead_service_freq_array[i] == "Mon") {
							new_service_freq[0] = "1";
						}
						if (lead_service_freq_array[i] == "Tue") {
							new_service_freq[1] = "1";
						}
						if (lead_service_freq_array[i] == "Wed") {
							new_service_freq[2] = "1";
						}
						if (lead_service_freq_array[i] == "Thu") {
							new_service_freq[3] = "1";
						}
						if (lead_service_freq_array[i] == "Fri") {
							new_service_freq[4] = "1";
						}
					}
					if (new_service_freq[0] == "1") {
						freqArray += "Monday, ";
					}
					if (new_service_freq[1] == "1") {
						freqArray += "Tuesday, ";
					}
					if (new_service_freq[2] == "1") {
						freqArray += "Wednesday, ";
					}
					if (new_service_freq[3] == "1") {
						freqArray += "Thursday, ";
					}
					if (new_service_freq[4] == "1") {
						freqArray += "Friday, ";
					}
					if (new_service_freq[5] == "1") {
						freqArray += "Adhoc, ";
					}
					var emailSubject = "LPO Scheduled Service Created - " + business_name;
					var linkToNSPage =
						"https://1048144.app.netsuite.com/app/site/hosting/scriptlet.nl?script=2183&deploy=1";
					var emailBody =
						"A new scheduled service has been created for the following customer:<br><br>";
					emailBody += "<b>Customer Name:</b> " + business_name + "<br>";
					emailBody +=
						"<b>Contact Name:</b> " + first_name + " " + last_name + "<br>";
					emailBody += "<b>Contact Email:</b> " + contact_email + "<br>";
					emailBody += "<b>Contact Phone:</b> " + phone_number + "<br>";
					emailBody +=
						"<b>Service Type:</b> " + leadSelectedServiceText + "<br>";
					emailBody += "<b>Service Date:</b> " + leadServiceDate + "<br>";
					if (!isNullorEmpty(freqArray)) {
						emailBody += "<b>Service Frequency:</b> " + freqArray + "<br>";
					}
					emailBody +=
						'<b>Link to LPO Opportunity Leads List Page:</b> <a href="' +
						linkToNSPage +
						'" target="_blank">Click Here</a><br><br>';
					emailBody +=
						"<br>Please follow up to ensure the customer is onboarded successfully.<br><br>";
					emailBody += "Thank you,<br>The System";

					// email.send({
					// 	author: 112209, //MailPlus Team
					// 	body: emailBody,
					// 	recipients: [
					// 		"michael.mcdaid@mailplus.com.au",
					// 		"kerry.oneill@mailplus.com.au"
					// 	],
					// 	cc: [
					// 		"ankith.ravindran@mailplus.com.au",
					// 		"mailplusit@mailplus.com.au"
					// 	],
					// 	subject: emailSubject,
					// 	relatedRecords: { entityId: lpoScheduleServiceCustomerInternalID }
					// });

					//Load Comm Reg Record to get the SCF Link
					var commRegRecord = record.load({
						type: "customrecord_commencement_register",
						id: newCommRegInternalId,
						isDynamic: true
					});

					var scfLink = commRegRecord.getValue({
						fieldId: "custrecord_dynamic_scf_url"
					});

					if (lpoNewcustomerServiceType == "scheduled") {
						if (billing == "lpo") {
							//Email to be sent to LPO and Zee about the scheduled service with the SCF Link
							var emailSubjectToLPOZee =
								"New Scheduled Customer - " + business_name;

							var emailToLPOBody =
								"<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>.email-container{font-family: 'Fraunces', serif;max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.05);border:1px solid #f0f0f0;}.header{background-color:#095c7b;padding:40px 20px;text-align:center;}.header h1{color:#ffffff;margin:0;font-size:24px;font-weight:300;letter-spacing:1px;}.header span{color:#EAF044;font-weight:bold;}.content{padding:40px 30px;color:#333333;line-height:1.6;}.greeting{font-size:18px;margin-bottom:20px;color:#095c7b;font-weight:bold;}.action-box{background-color:#f8fafb;border-radius:8px;padding:25px;margin:30px 0;border-left:4px solid #EAF044;}.button-container{text-align:center;margin:40px 0;}.btn-primary{background-color:#EAF044;color:#095c7b;padding:16px 32px;text-decoration:none;font-weight:bold;border-radius:8px;display:inline-block;transition:background 0.3s;box-shadow:0 4px 12px rgba(234,240,68,0.3);text-transform:uppercase;}.footer{background-color:#f4f7f8;padding:30px;text-align:center;font-size:12px;color:#999;}.footer p{margin:5px 0;}</style></head>";
							var year = new Date().getFullYear();
							//Send out SCF to LPO & Zee to show the scheduled service for the customer that the LPO is paying.
							//This email notifies the LPO and Zee what the SCF link is for the scheduled service so they can track the onboarding process of the customer.
							emailToLPOBody +=
								'<body><div class="email-container"><div class="header"><h1>lpo<span>.plus</span></h1></div><div class="content"><div class="greeting">New Scheduled Customer</div><p>The recurring pickup you booked for ' +
								business_name +
								" has been scheduled. The Job request has been sent to the franchisee for acceptance.</p>";
							//Job Details Section

							var serviceTextInEmail = "";
							if (leadSelectedServiceText == "AMPO") {
								serviceTextInEmail = "LPO - TO - SITE";
							} else if (leadSelectedServiceText == "PMPO") {
								serviceTextInEmail = "SITE - TO - LPO";
							} else if (leadSelectedServiceText == "Package: AMPO & PMPO") {
								serviceTextInEmail = "Round Trip";
							}
							var prettyDate = formatDateToLongReadable(leadServiceDate);
							emailToLPOBody +=
								'<div class="job-details"><div class="detail-row"><span class="detail-label">Service:</span><span class="detail-value">' +
								serviceTextInEmail +
								'</span></div><div class="detail-row"><span class="detail-label">Date:</span><span class="detail-value">' +
								prettyDate +
								"</span></div>";
							if (!isNullorEmpty(freqArray)) {
								emailToLPOBody +=
									'<div class="detail-row"><span class="detail-label">Frequency:</span><span class="detail-value">' +
									freqArray +
									"</span></div>";
							}

							emailBody += "</div>";

							emailToLPOBody +=
								'<div class="detail-row"><span class="detail-label">SCF Link:</span><span class="detail-value"><a href="' +
								scfLink +
								'" target="_blank">Click Here</a></span></div>';

							emailToLPOBody +=
								'<div class="footer"><p><strong>lpo.plus</strong> | Local logistics, made simple.</p><p>Powered by MailPlus Australia</p><p style="margin-top:15px;">&copy; ' +
								year +
								" lpo.plus. All rights reserved.</p></div></div></body></html>";

							var sendOutEmailJSON = {
								to: [parentLPOEmail],
								subject: emailSubjectToLPOZee,
								html: emailToLPOBody,
								metadata: {
									lpoId: parent_lpo,
									customerId: lpoScheduleServiceCustomerInternalID
								}
							};
							var firebaseUpdateURL =
								"https://sendemailfromnetsuite-65tt2ndmpq-uc.a.run.app";

							var apiHeaders = {};
							apiHeaders["Content-Type"] = "application/json";
							apiHeaders["x-api-key"] =
								"f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123";
							//f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123

							var response = https.request({
								method: https.Method.POST,
								url: firebaseUpdateURL,
								body: JSON.stringify(sendOutEmailJSON),
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

							// email.send({
							// 	author: 112209, //MailPlus Team
							// 	body: emailBodyToLPOZee,
							// 	recipients: [parentLPOEmail, zeeEmail],
							// 	cc: [
							// 		"michael.mcdaid@mailplus.com.au",
							// 		"kerry.oneill@mailplus.com.au",
							// 		"mailplusit@mailplus.com.au"
							// 	],
							// 	subject: emailSubjectToLPOZee,
							// 	relatedRecords: {
							// 		entityId: lpoScheduleServiceCustomerInternalID
							// 	}
							// });
						} else if (billing == "customer") {
							//Send out SCF to LPO, Zee, and Customer to show the scheduled service for the customer that the customer is paying.

							var suiteletUrl =
								"https://1048144.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=395&deploy=1&compid=1048144&ns-at=AAEJ7tMQgAVHkxJsbXgGwQQm4xn968o7JJ9-Ym7oanOzCSkWO78&rectype=customer&template=264"; //Camp Communication TemplateID: 	202510 - LPO Verify Schedule Service
							suiteletUrl +=
								"&recid=" +
								lpoScheduleServiceCustomerInternalID +
								"&salesrep=" +
								1822062 +
								"&dear=" +
								first_name +
								"&contactid=" +
								contactId +
								"&userid=" +
								1822062 +
								"&startdate=" +
								lead_service_date +
								"&commreg=" +
								newCommRegInternalId;

							var newLeadEmailTemplateRecord = record.load({
								type: "customrecord_camp_comm_template",
								id: 264 //Camp Communication TemplateID: 	202510 - LPO Verify Schedule Service
							});
							var templateSubject = newLeadEmailTemplateRecord.getValue({
								fieldId: "custrecord_camp_comm_subject"
							});

							var response = https.get({
								url: suiteletUrl
							});
							var emailHtml = response.body;

							// email.send({
							// 	author: 1822062, //Kerry
							// 	body: emailHtml,
							// 	recipients: contact_email,
							// 	subject: templateSubject,
							// 	cc: [
							// 		"michael.mcdaid@mailplus.com.au",
							// 		"kerry.oneill@mailplus.com.au",
							// 		"mailplusit@mailplus.com.au",
							// 		parentLPOEmail
							// 	],
							// 	relatedRecords: {
							// 		entityId: lpoScheduleServiceCustomerInternalID
							// 	}
							// });

							var sendOutEmailJSON = {
								to: contact_email,
								cc: [parentLPOEmail],
								subject: templateSubject,
								html: emailHtml,
								metadata: {
									lpoId: parent_lpo,
									customerId: lpoScheduleServiceCustomerInternalID
								}
							};
							var firebaseUpdateURL =
								"https://sendemailfromnetsuite-65tt2ndmpq-uc.a.run.app";

							var apiHeaders = {};
							apiHeaders["Content-Type"] = "application/json";
							apiHeaders["x-api-key"] =
								"f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123";
							//f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123

							var response = https.request({
								method: https.Method.POST,
								url: firebaseUpdateURL,
								body: JSON.stringify(sendOutEmailJSON),
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

							//Email to be sent to LPO and Zee about the scheduled service with the SCF Link and letting them know waiting for the customer the T&C's
							var emailSubjectToLPOZee =
								"New Scheduled Customer - " + business_name;

							var emailToLPOBody =
								"<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>.email-container{font-family: 'Fraunces', serif;max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.05);border:1px solid #f0f0f0;}.header{background-color:#095c7b;padding:40px 20px;text-align:center;}.header h1{color:#ffffff;margin:0;font-size:24px;font-weight:300;letter-spacing:1px;}.header span{color:#EAF044;font-weight:bold;}.content{padding:40px 30px;color:#333333;line-height:1.6;}.greeting{font-size:18px;margin-bottom:20px;color:#095c7b;font-weight:bold;}.action-box{background-color:#f8fafb;border-radius:8px;padding:25px;margin:30px 0;border-left:4px solid #EAF044;}.button-container{text-align:center;margin:40px 0;}.btn-primary{background-color:#EAF044;color:#095c7b;padding:16px 32px;text-decoration:none;font-weight:bold;border-radius:8px;display:inline-block;transition:background 0.3s;box-shadow:0 4px 12px rgba(234,240,68,0.3);text-transform:uppercase;}.footer{background-color:#f4f7f8;padding:30px;text-align:center;font-size:12px;color:#999;}.footer p{margin:5px 0;}</style></head>";
							var year = new Date().getFullYear();
							//Send out SCF to LPO & Zee to show the scheduled service for the customer that the LPO is paying.

							emailToLPOBody +=
								'<body><div class="email-container"><div class="header"><h1>lpo<span>.plus</span></h1></div><div class="content"><div class="greeting">New Scheduled Customer</div><p>The recurring job you booked for ' +
								business_name +
								" has been scheduled. The Job request has been sent to the franchisee for acceptance.</p>";
							//Job Details Section

							var serviceTextInEmail = "";
							if (leadSelectedServiceText == "AMPO") {
								serviceTextInEmail = "LPO - TO - SITE";
							} else if (leadSelectedServiceText == "PMPO") {
								serviceTextInEmail = "SITE - TO - LPO";
							} else if (leadSelectedServiceText == "Package: AMPO & PMPO") {
								serviceTextInEmail = "Round Trip";
							}
							var prettyDate = formatDateToLongReadable(leadServiceDate);
							emailToLPOBody +=
								'<div class="job-details"><div class="detail-row"><span class="detail-label">Service:</span><span class="detail-value">' +
								serviceTextInEmail +
								'</span></div><div class="detail-row"><span class="detail-label">Date:</span><span class="detail-value">' +
								prettyDate +
								"</span></div>";
							if (!isNullorEmpty(freqArray)) {
								emailToLPOBody +=
									'<div class="detail-row"><span class="detail-label">Frequency:</span><span class="detail-value">' +
									freqArray +
									"</span></div>";
							}

							emailBody += "</div>";

							emailToLPOBody +=
								'<div class="detail-row"><span class="detail-label">SCF Link:</span><span class="detail-value"><a href="' +
								scfLink +
								'" target="_blank">Click Here</a></span></div>';

							emailToLPOBody +=
								'<div class="footer"><p><strong>lpo.plus</strong> | Local logistics, made simple.</p><p>Powered by MailPlus Australia</p><p style="margin-top:15px;">&copy; ' +
								year +
								" lpo.plus. All rights reserved.</p></div></div></body></html>";

							var sendOutEmailJSON = {
								to: [parentLPOEmail],
								subject: emailSubjectToLPOZee,
								html: emailToLPOBody,
								metadata: {
									lpoId: parent_lpo,
									customerId: lpoScheduleServiceCustomerInternalID
								}
							};
							var firebaseUpdateURL =
								"https://sendemailfromnetsuite-65tt2ndmpq-uc.a.run.app";

							var apiHeaders = {};
							apiHeaders["Content-Type"] = "application/json";
							apiHeaders["x-api-key"] =
								"f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123";
							//f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123

							var response = https.request({
								method: https.Method.POST,
								url: firebaseUpdateURL,
								body: JSON.stringify(sendOutEmailJSON),
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

							// email.send({
							// 	author: 112209, //MailPlus Team
							// 	body: emailBodyToLPOZee,
							// 	recipients: [parentLPOEmail, zeeEmail],
							// 	cc: [
							// 		"michael.mcdaid@mailplus.com.au",
							// 		"kerry.oneill@mailplus.com.au",
							// 		"mailplusit@mailplus.com.au"
							// 	],
							// 	subject: emailSubjectToLPOZee,
							// 	relatedRecords: {
							// 		entityId: lpoScheduleServiceCustomerInternalID
							// 	}
							// });
						}
					}
				}

				log.audit({
					title:
						'End of zee "' +
						finalZeeIDArray[fza] +
						'" Subcustomer Creation Process',
					details:
						"Subcustomer creation process completed for zee: " +
						finalZeeIDArray[fza]
				});
			}

			log.audit({
				title: "All Subcustomer Creation Process Completed",
				details: "Subcustomer creation process completed for all zees."
			});

			var customerDetails = '{"fields": {';

			customerDetails +=
				'"companyId": {"stringValue": "' +
				lpoScheduledServiceCustomerInternalID +
				'"},';
			customerDetails +=
				'"customerEntityId": {"stringValue": "' +
				lpoScheduledServiceCustomerEntityID +
				'"},';

			customerDetails +=
				'"companyName": {"stringValue": "' + business_name + '"},';
			customerDetails +=
				'"franchisee": {"stringValue": "' + finalZeeIDArray + '"},';
			customerDetails +=
				'"franchiseeText": {"stringValue": "' + lpoLinkedZeeTextArray + '"},';
			customerDetails +=
				'"franchiseeTerritoryJSON": {"arrayValue": { "values": [';
			lpoSuburbMappingJSON.forEach(function (suburb) {
				var stringValue =
					suburb.suburbs + ", " + suburb.state + " " + suburb.post_code;
				customerDetails += '{"stringValue": "' + stringValue + '"},';
			});
			customerDetails += "]}},";

			//Contact Fields
			customerDetails +=
				'"customerPhone": {"stringValue": "' + phone_number + '"},';
			customerDetails +=
				'"customerEmail": {"stringValue": "' + contact_email + '"},';
			customerDetails +=
				'"customerServiceEmail": {"stringValue": "' + contact_email + '"},';
			customerDetails += '"billing": {"stringValue": "' + billing + '"},';
			customerDetails +=
				'"jobtype": {"stringValue": "' + lpoNewcustomerServiceType + '"},';

			//Address Fields
			if (!isNullorEmpty(address1)) {
				customerDetails += '"address1": {"stringValue": "' + address1 + '"},';
			} else {
				customerDetails += '"address1": {"stringValue": ""},';
			}

			customerDetails += '"street": {"stringValue": "' + address2 + '"},';
			customerDetails += '"city": {"stringValue": "' + city + '"},';
			customerDetails += '"state": {"stringValue": "' + state + '"},';
			customerDetails += '"zip": {"stringValue": "' + postcode + '"},';

			//LPO Details
			customerDetails +=
				'"lpoParentInternalID": {"stringValue": "' + parent_lpo + '"},';
			customerDetails += '"lpoParentName": {"stringValue": "' + lpoName + '"},';

			//Service Rates
			customerDetails +=
				'"lpoServiceAMPOInternalID": {"stringValue": "' +
				localmileAMPOInternalID +
				'"},';
			customerDetails +=
				'"lpoServiceAMPORate": {"stringValue": "' + localmileAMPORate + '"},';
			customerDetails +=
				'"lpoServicePMPOInternalID": {"stringValue": "' +
				localmilePMPOInternalID +
				'"},';
			customerDetails +=
				'"lpoServicePMPORate": {"stringValue": "' + localmilePMPORate + '"},';
			customerDetails +=
				'"lpoServiceAMPOPMPOInternalID": {"stringValue": "' +
				localmileAMPOPMPOInternalID +
				'"},';
			customerDetails +=
				'"lpoServiceAMPOPMPORate": {"stringValue": "' +
				localmileAMPOPMPORate +
				'"},';
			customerDetails +=
				'"lpoServiceAdditionalBagInternalID": {"stringValue": "' +
				localmileAdditionalBagInternalID +
				'"},';
			customerDetails +=
				'"lpoServiceAdditionalBagRate": {"stringValue": "' +
				localmileAdditionalBagRate +
				'"},';

			//Customer Contact Details
			customerDetails +=
				'"firstName": {"stringValue": "' + first_name + '"},';
			customerDetails +=
				'"first_name": {"stringValue": "' + first_name + '"},';
			customerDetails +=
				'"lastName": {"stringValue": "' + last_name + '"},';
			customerDetails +=
				'"last_name": {"stringValue": "' + last_name + '"},';
			//LPO Address Fields
			customerDetails +=
				'"lpoAddress1": {"stringValue": "' + lpoAddress1 + '"},';
			customerDetails += '"lpoStreet": {"stringValue": "' + lpoAddress2 + '"},';
			customerDetails += '"lpoCity": {"stringValue": "' + lpoCity + '"},';
			customerDetails += '"lpoState": {"stringValue": "' + lpoState + '"},';
			customerDetails += '"lpoZip": {"stringValue": "' + lpoZip + '"},';
			//LPO Contact Details
			customerDetails +=
				'"lpoContactName": {"stringValue": "' + lpoContactName + '"},';
			customerDetails +=
				'"lpoContactPhone": {"stringValue": "' + lpoContactPhone + '"},';
			customerDetails +=
				'"lpoContactEmail": {"stringValue": "' + lpoContactEmail + '"},';
			if (billing == "customer") {
				customerDetails +=
					'"status": {"stringValue": "Awaiting T&C\'s to be Accepted"},';
			} else {
				customerDetails += '"status": {"stringValue": "Active"},';
			}
			customerDetails += linkedZeeDetails;
			customerDetails += "}}";

			log.debug({
				title: "customerDetails",
				details: customerDetails
			});

			// if (billing == "customer" && lpoNewcustomerServiceType != "scheduled") {
			//Create Lead Firebase Record in Firestore
			// Tue, May 5, 2026 @ 11:28:28 AM [UPDATE] - No More access to LocalMile from LPO.PLUS application.
			// var url =
			//     'https://firestore.googleapis.com/v1/projects/localmile-express/databases/(default)/documents/companies?documentId=' + lpoScheduledServiceCustomerInternalID.toString();
			// var headerObj = {
			//     name: 'Content-Type',
			//     value: 'application/json'
			// };
			// var response = https.post({
			//     url: url,
			//     body: customerDetails,
			//     headers: headerObj
			// });
			// log.debug({
			//     title: 'response',
			//     details: response
			// });
			//Send Email to Customer with link to join LocalMile
			// if (!isNullorEmpty(contact_email)) {
			//     var localmileJoinLink = 'https://localmile.com.au/auth/join?companyId=' + lpoScheduledServiceCustomerInternalID.toString();
			//     // TODO: Send Welcome Email to customer for LocalMile Portal Access
			//     var subject = lpoName + ' Post Office has set up your MailPlus account';
			//     var emailBody = 'Hi ' + first_name + ',<br><br>';
			//     emailBody += 'Great news – ' + lpoName + ', Post Office has requested to activate a MailPlus account for you. <br><br>';
			//     emailBody += 'This gives you access to book ad hoc parcel collections to and from  ' + lpoName + ' Post Office whenever you need them – all managed through our online platform, <b>LocalMile</b><br><br>';
			//     emailBody += '<b style="font-size: 12pt;color: #095c7b;">Click below to activate your account and get started. </b><br>';
			//     emailBody += '<b><a href="' + localmileJoinLink + '" target="_blank">Join LocalMile</a></b><br></br>';
			//     emailBody += 'Once you\'re set up, you can book collections on demand, manage your bookings, and communicate with your driver all in one place. No lock-in contracts, just convenience when you need it. No more hunting for parking. No more queues. Just reliable collections so you can focus on running your business.<br><br>';
			//     emailBody += '<b style="font-size: 12pt;color: #095c7b;">Who are MailPlus?  </b><br>';
			//     emailBody += 'We\'re a local courier service working with local Post Offices to make parcel collection and lodgement effortless. <br><br>';
			//     emailBody += '<b style="font-size: 12pt;color: #095c7b;">Need help?   </b><br>';
			//     emailBody += 'Simply reply to this email or call <b>1300 65 65 95</b>, option 2, to speak to our Customer Service team. <br><br>';
			//     emailBody += 'Thank you,<br>';
			//     emailBody += 'The MailPlus Team<br><br>';
			//     email.send({
			//         author: 1937051, //LocalMile
			//         body: emailBody,
			//         recipients: contact_email,
			//         subject: subject,
			//         relatedRecords: { entityId: lpoScheduledServiceCustomerInternalID },
			//     })
			//     //Send Email to LPO & Kerry/Michael about letting them know an email sent to the end customer to join LocalMile.
			//     var subjectToLPOKerryMichael = 'LocalMile Invitation Sent to Customer - ' + business_name;
			//     var emailBodyToLPOKerryMichael = 'An email invitation to join LocalMile has been sent to the customer for the following scheduled service:<br><br>';
			//     emailBodyToLPOKerryMichael += '<b>Customer Name:</b> ' + business_name + '<br>';
			//     emailBodyToLPOKerryMichael += '<b>Contact Name:</b> ' + first_name + ' ' + last_name + '<br>';
			//     emailBodyToLPOKerryMichael += '<b>Contact Email:</b> ' + contact_email + '<br>';
			//     emailBodyToLPOKerryMichael += '<b>Contact Phone:</b> ' + phone_number + '<br>';
			//     emailBodyToLPOKerryMichael += 'Thank you,<br>The System';
			//     email.send({
			//         author: 1937051, //LocalMile
			//         body: emailBodyToLPOKerryMichael,
			//         recipients: [parentLPOEmail, 'michael.mcdaid@mailplus.com.au', 'kerry.oneill@mailplus.com.au'],
			//         cc: ['mailplusit@mailplus.com.au'],
			//         subject: subjectToLPOKerryMichael,
			//         relatedRecords: { entityId: lpoScheduledServiceCustomerInternalID },
			//     })
			// }
			// }
			// }

			var urlCereateCustomerSubCollection =
				"https://firestore.googleapis.com/v1/projects/mp-lpo-connect/databases/lpoconnect/documents/lpo/" +
				parent_lpo +
				"/customers?documentId=" +
				lpoScheduledServiceCustomerInternalID.toString();

			var headerObj = {
				name: "Content-Type",
				value: "application/json"
			};

			var responseCreateSubCustomer = https.post({
				url: urlCereateCustomerSubCollection,
				body: customerDetails,
				headers: headerObj
			});

			log.debug({
				title: "responseCreateSubCustomer",
				details: responseCreateSubCustomer
			});

			var returnObj = {
				success: true,
				message: "NetSuite records created successfully",
				customerInternalId: lpoScheduledServiceCustomerInternalID,
				result: ""
			};

			log.debug({
				title: "returnObj",
				details: returnObj
			});

			_sendJSResponse(context.request, context.response, returnObj);
		} else {
		}
	}

	/**
	 * @description Check if a suburb, state, and postcode combination exists in a JSON array.
	 * @author Ankith Ravindran (AR)
	 * @date 28/09/2025
	 * @param {*} jsonArray
	 * @param {*} suburb
	 * @param {*} state
	 * @param {*} postcode
	 * @returns {*}
	 */
	function suburbStatePostcodeExists(jsonArray, suburb, state, postcode) {
		log.audit({
			title: "suburbStatePostcodeExists",
			details: {
				suburb: suburb,
				state: state,
				postcode: postcode,
				jsonArray: jsonArray
			}
		});
		for (var i = 0; i < jsonArray.length; i++) {
			if (
				jsonArray[i].suburbs === suburb.toUpperCase() &&
				jsonArray[i].state === state &&
				jsonArray[i].post_code === postcode
			) {
				return true;
			}
		}
		return false;
	}

	function getDate() {
		var date = new Date();
		if (date.getHours() > 6) {
			date.setDate(date.getDate() + 1);
		}

		format.format({
			value: date,
			type: format.Type.DATE,
			timezone: format.Timezone.AUSTRALIA_SYDNEY
		});

		return date;
	}

	function _sendJSResponse(request, response, respObject) {
		// response.setContentType("JAVASCRIPT");
		response.setHeader("Access-Control-Allow-Origin", "*");
		var callbackFcn = request.jsoncallback || request.callback;
		if (callbackFcn) {
			response.writeLine({
				output: callbackFcn + "(" + JSON.stringify(respObject) + ");"
			});
		} else response.writeLine({ output: JSON.stringify(respObject) });
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
			if (
				serviceList[i].name.trim().toLowerCase() ==
				serviceName.trim().toLowerCase()
			) {
				return { rate: serviceList[i].rate, id: serviceList[i].id };
			}
		}
		return null; // Not found
	}

	function generateEncryptedUrl(
		lpoLeadParentLPOCustomerId,
		lpoParentLPOSubCustomerforAdhocBookingInternalId
	) {
		const url =
			"https://1048144.app.netsuite.com/app/site/hosting/scriptlet.nl?script=2129&deploy=1";
		const plainText = JSON.stringify({
			lpoparentid: lpoLeadParentLPOCustomerId,
			lposubcustomer: lpoParentLPOSubCustomerforAdhocBookingInternalId
		}); // The idea here is to put comm reg id in the url but encrypted so that we don't expose our internal ids
		var secretKey = getSecretKey();

		log.audit({
			title: "secretKey",
			details: secretKey
		});

		var encrypted = encryptURL(plainText, secretKey);

		return url + "&ct=" + encrypted.ciphertext + "&iv=" + encrypted.iv; // the final encrypted url containing the cipher text and the iv
	}

	function getSecretKey() {
		var secret = "custsecret_lpo_job_booking_page";
		return crypto.createSecretKey({
			encoding: encode.Encoding.UTF_8,
			secret: secret // ID of the secret from the Secrets Management
		});
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
		});

		return date;
	}

	function encryptURL(plainText, secretKey) {
		var cipher = crypto.createCipher({
			algorithm: crypto.EncryptionAlg.AES, // AES-CBC, PKCS5 padding by default
			padding: crypto.Padding.PKCS5Padding, // already the default, put it here for clarity
			key: secretKey
		});

		cipher.update({
			input: plainText,
			inputEncoding: encode.Encoding.UTF_8
		});

		return cipher.final({ outputEncoding: encode.Encoding.BASE_64_URL_SAFE });
	}

	function isNullorEmpty(strVal) {
		return (
			strVal == null ||
			strVal == "" ||
			strVal == "null" ||
			strVal == undefined ||
			strVal == "undefined" ||
			strVal == "- None -" ||
			strVal == "0"
		);
	}

	function getDateToday() {
		var date = new Date();
		format.format({
			value: date,
			type: format.Type.DATE,
			timezone: format.Timezone.AUSTRALIA_SYDNEY
		});

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

	function getOrdinalSuffix(day) {
		if (day % 100 >= 11 && day % 100 <= 13) {
			return "th";
		}

		switch (day % 10) {
			case 1:
				return "st";
			case 2:
				return "nd";
			case 3:
				return "rd";
			default:
				return "th";
		}
	}

	function formatDateToLongReadable(dateStr) {
		if (isNullorEmpty(dateStr)) {
			return "";
		}

		var parts = dateStr.split("-");
		if (parts.length !== 3) {
			return dateStr;
		}

		var year = parseInt(parts[0], 10);
		var monthIndex = parseInt(parts[1], 10) - 1;
		var day = parseInt(parts[2], 10);

		if (isNaN(year) || isNaN(monthIndex) || isNaN(day)) {
			return dateStr;
		}

		var weekdayNames = [
			"Sunday",
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday"
		];

		var monthNames = [
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December"
		];

		// Use UTC to avoid timezone shifts that can change weekday/date unexpectedly.
		var parsedDate = new Date(Date.UTC(year, monthIndex, day));
		var weekday = weekdayNames[parsedDate.getUTCDay()];
		var month = monthNames[monthIndex];

		if (isNullorEmpty(weekday) || isNullorEmpty(month)) {
			return dateStr;
		}

		return (
			weekday + ", " + day + getOrdinalSuffix(day) + " " + month + " " + year
		);
	}

	return {
		onRequest: onRequest
	};
});
