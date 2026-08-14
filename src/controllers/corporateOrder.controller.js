const corporateService = require('../services/corporateOrder.service');
const emailService = require('../services/email.service');
const { successRes, errorRes } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');

const create = catchAsync(async (req, res) => {
  const { name, company_name, email, phone, message, agree_contact } = req.body;

  if (!name || !company_name || !email || !phone) {
    return errorRes(res, "Name, Company Name, Email and Phone are required", 400);
  }

  const id = await corporateService.createCorporateOrder(
    name,
    company_name,
    email,
    phone,
    message,
    agree_contact
  );

  emailService.sendCorporateInquiryEmails({ name, company_name, email, phone, message });

  return successRes(res, "Corporate inquiry submitted successfully", { id }, null, 201);
});

const getAll = catchAsync(async (req, res) => {
  const search = req.query.search || "";
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const { data, meta } = await corporateService.getAllCorporateOrders(search, page, limit);

  return successRes(res, "Corporate orders fetched successfully", data, meta);
});

const updateStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) return errorRes(res, "Status is required", 400);

  const updated = await corporateService.updateOrderStatus(id, status);
  if (!updated) return errorRes(res, "Corporate order not found", 404);

  return successRes(res, "Status updated successfully");
});

const remove = catchAsync(async (req, res) => {
  const { id } = req.params;
  const deleted = await corporateService.deleteOrder(id);
  if (!deleted) return errorRes(res, "Corporate order not found", 404);

  return successRes(res, "Corporate order removed successfully");
});

module.exports = {
  create,
  getAll,
  updateStatus,
  remove
};
