// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CyberGrid Token (CGRD)
/// @notice Minimal ERC-20 minted by a trusted backend operator per virus kill.
///         Token value scales with virus morphological complexity.
contract CyberGridToken {
    string public constant name     = "CyberGrid";
    string public constant symbol   = "CGRD";
    uint8  public constant decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    /// @dev Only this address may call mint().
    address public minter;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event MinterChanged(address indexed previous, address indexed next);

    constructor() { minter = msg.sender; }

    function setMinter(address next) external {
        require(msg.sender == minter, "CGRD: not minter");
        emit MinterChanged(minter, next);
        minter = next;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == minter, "CGRD: not minter");
        totalSupply       += amount;
        balanceOf[to]     += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "CGRD: insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to]   += amount;
        emit Transfer(from, to, amount);
    }
}
