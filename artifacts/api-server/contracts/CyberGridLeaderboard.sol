// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CyberGrid Leaderboard
/// @notice Maintains the top-10 scores on-chain. Only a trusted backend
///         submitter may write entries; anyone may read.
contract CyberGridLeaderboard {
    struct Entry {
        address player;
        uint96  score;
        uint32  wave;
        uint32  timestamp;
    }

    Entry[10] private _entries;
    uint256 public  entryCount;
    address public  submitter;

    event ScoreSubmitted(address indexed player, uint96 score, uint32 wave, uint8 rank);
    event SubmitterChanged(address indexed previous, address indexed next);

    constructor() { submitter = msg.sender; }

    function setSubmitter(address next) external {
        require(msg.sender == submitter, "LB: not submitter");
        emit SubmitterChanged(submitter, next);
        submitter = next;
    }

    /// @notice Insert a score into the top-10 if it qualifies.
    function submit(address player, uint96 score, uint32 wave) external returns (int8 rank) {
        require(msg.sender == submitter, "LB: not submitter");

        uint256 filled = entryCount < 10 ? entryCount : 10;

        // Find insertion position
        uint256 pos = filled; // default = "not in top-10"
        for (uint256 i = 0; i < filled; i++) {
            if (score > _entries[i].score) { pos = i; break; }
        }
        if (pos == 10) return -1; // not a top-10 score

        // Shift lower entries down
        uint256 last = filled < 9 ? filled : 9;
        for (uint256 i = last; i > pos; i--) _entries[i] = _entries[i - 1];

        _entries[pos] = Entry(player, score, wave, uint32(block.timestamp));
        if (entryCount < 10) entryCount++;

        emit ScoreSubmitted(player, score, wave, uint8(pos));
        return int8(int256(pos));
    }

    function getLeaderboard() external view returns (Entry[10] memory) {
        return _entries;
    }

    function getEntry(uint256 index) external view returns (Entry memory) {
        require(index < entryCount, "LB: out of range");
        return _entries[index];
    }
}
