const menuItemService = require('../services/menuItem.service');

const getMenuItems = async (req, res) => {
  try {
    const { location, activeOnly } = req.query;
    const items = await menuItemService.getMenuItems({ location, activeOnly });
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch menu items' });
  }
};

const createMenuItem = async (req, res) => {
  try {
    const data = req.body;
    const newItem = await menuItemService.createMenuItem(data);
    res.status(201).json({ success: true, data: newItem, message: 'Menu item created successfully' });
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({ success: false, message: 'Failed to create menu item' });
  }
};

const updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const updatedItem = await menuItemService.updateMenuItem(id, data);
    res.json({ success: true, data: updatedItem, message: 'Menu item updated successfully' });
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({ success: false, message: 'Failed to update menu item' });
  }
};

const deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await menuItemService.deleteMenuItem(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    res.json({ success: true, message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({ success: false, message: 'Failed to delete menu item' });
  }
};

module.exports = {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem
};
